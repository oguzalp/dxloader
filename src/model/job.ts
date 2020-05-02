import { Task } from "./task";
import { Connection } from "@salesforce/core";

import { BulkOptions } from "jsforce";
import { mapFieldResult, getTime } from "./helper";
import { isArray } from "util";

const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 25000;
const CONCURRENCY_MODE = "Serial";

export class Job {

	public static async bulkQuery(task: Task, sourceConn: Connection): Promise<any> {
		let records = [];
		sourceConn.bulk.pollTimeout = POLL_TIMEOUT;
		sourceConn.bulk.pollInterval = POLL_INTERVAL;

		return new Promise<any>((resolve, reject) => {
			sourceConn.bulk.query(task.query).on('record', (rec) => {
				records.push(rec);
			})
				.on('error', (err) => { console.log(err); reject(err) })
				.on('end', () => {
					resolve(records);
				});
		})
	}

	public static async bulkImport(task: Task, targetConn: Connection, records: Array<object>): Promise<object> {

		targetConn.bulk.pollTimeout = POLL_TIMEOUT;
		targetConn.bulk.pollInterval = POLL_INTERVAL;
		var options: BulkOptions;

		options = {
			concurrencyMode: CONCURRENCY_MODE,
			extIdField: task.operation == 'upsert' ? task.externalId : undefined
		}

		return new Promise<object>((resolve, reject) => {
			targetConn.bulk.load(task.object, task.operation, options, records, (err, res) => {
				if (err) {
					reject(err)
				}		
				resolve(res);
			});
		})
	}

	public static async runTask(task: Task, sourceCon: Connection, targetCon: Connection) {

		let querResultProcessErrors,
			_bulkResultProcessErrors,
			_bulkFailedRecords,errorRecords: Array<any> = [];

		let _queryResult, _bulkResult:any;

		_queryResult = await Job.bulkQuery(task, sourceCon)
			.catch(err => querResultProcessErrors.push(err))

		if (isArray(_queryResult) && _queryResult.length > 0) {
	
			let new_result = mapFieldResult(task.map, _queryResult);

			_bulkResult = await Job.bulkImport(task, targetCon, new_result)
				.catch(err => _bulkResultProcessErrors.push(err))
			
			console.log(`[${getTime()}]:[${task.object}] ${_queryResult.length} records fetched.`);

			if (isArray(_bulkResult) && _bulkResult.length > 0) {
				errorRecords = _bulkResult.filter(r => { return (!r.success) });
				console.log(`[${getTime()}]:[${task.name}][${task.object}]:[${task.operation}] ${_bulkResult.length - errorRecords.length} record(s) have been successfully processed. | ${errorRecords.length} record(s) have been failed.`)				
				_bulkFailedRecords = errorRecords.map(er => {
					return er.errors.join('|')
				});
			}
		}

		return {
			task: task.name,
			queryResult: _queryResult.length,
			bulkQueryJobErrors: querResultProcessErrors,
			bulkLoadJobErrors: _bulkResultProcessErrors,
			bulkProcessedSuccessRecords: (_bulkResult.length - errorRecords.length),
			bulkFailedRecordMessages: _bulkFailedRecords
		}
	}
}



