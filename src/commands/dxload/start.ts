import { flags, SfdxCommand, FlagsConfig } from '@salesforce/command';
import { Messages, Org, SfdxProject,Connection  } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { BulkLoadOperation } from 'jsforce';
import { mapFieldResult,getTime } from '../../util'

import * as fs from 'fs';
import * as path from 'path';
import { isNullOrUndefined, isArray } from 'util';
import { BulkOptions } from 'jsforce';

const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 25000;
const CONCURRENCY_MODE = "Parallel";

export interface Task {
  name: string,
  query: string,
  operation: BulkLoadOperation, 
  object:string,
  externalId?: string,
  sequence?: number,
  map?: object
}


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('dxloader', 'org');

export default class Start extends SfdxCommand {

  
  public static examples = [
  `$ sfdx dxload:start --targetusername myTargetOrg@username.com --sourceusername mySourceOrg@username.com`,
  `$ sfdx dxload:start -u myTargetOrg@username.com -s mySourceOrg@username.com -p myloader-config.yaml`,
  `$ sfdx dxload:start -u targetAlias -s sourceAlias -p dataloader/dxloader.yaml -t task1,task2,task3 --json`
  ];


  protected static flagsConfig: FlagsConfig = {
    configpath: flags.string({
      char:'p',
      description:messages.getMessage('configurationPathDescription'),
      default: 'dxloader-config.yaml'
    }),
    sourceusername: flags.string({
       char:'s',
       description: messages.getMessage('sourceOrgDescription'),
       required: true 
      }),
    taskname: flags.array({
      char:'t',
      description: messages.getMessage('tasknameDescription'),
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;
  protected static supportsUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;
  protected static requiresDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  private sourceConn: Connection;
  private targetConn: Connection;
  
  public async run(): Promise<AnyJson> {
   
    const sourceOrgUserNameOrAlias = this.flags.sourceusername || '';
    const taskname:Array<string> = this.flags.taskname;
    const configFilePath = this.flags.configpath;

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername 
    this.targetConn = this.org.getConnection();
    const sourceOrg: Org = await Org.create({ aliasOrUsername:sourceOrgUserNameOrAlias });
    this.sourceConn = sourceOrg.getConnection();

    
    let projectPath = './';
    
    if(this.project){
      projectPath = this.project.getPath();
    }else
    {
      try{
        let project = await SfdxProject.resolve();
        projectPath = project.getPath();
      }catch(err){
          this.ux.warn("SFDX project could not be found!")
          //throw new SfdxError('No SFDX project!')
      }
    }

    const yaml = require('js-yaml');
    let configPath = path.join(projectPath,configFilePath);
  
    let configContent = fs.readFileSync(configPath,"utf-8");
    let configs = yaml.safeLoad(configContent);
   
    var tasks :Array<Task> = configs.tasks;

    if(!isNullOrUndefined(taskname)){
      
      tasks = tasks.filter( t=>{
        return (taskname.includes(t.name))
      }) 
    }
    
    this.ux.startSpinner(`process started`);   

    let response = [];
    //It is important to process all tasks in sequence
    for(const t of tasks){   
      const result = await this.runTask(t);
      response.push(result);
    }
    
    // Return an object to be displayed with --json
    return response
  }
    
  private async runTask(task: Task) {

		let querResultProcessErrors, _bulkResultProcessErrors
		  ,_bulkFailedRecords,errorRecords = [];

		let _queryResult, _bulkResult:any;

		_queryResult = await this.bulkQuery(task).catch(err => querResultProcessErrors.push(err))
    
    this.ux.log(`[${getTime()}]:[${task.object}] ${_queryResult.length} records fetched.`);

		if (isArray(_queryResult) && _queryResult.length > 0) {
	
			let new_result = mapFieldResult(task.map, _queryResult);

			_bulkResult = await this.bulkImport(task,new_result)
				.catch(err => _bulkResultProcessErrors.push(err))
			
			if (isArray(_bulkResult) && _bulkResult.length > 0) {
        
        errorRecords = _bulkResult.filter(r => { return (!r.success) });
        
        this.ux.log(`[${getTime()}]:[${task.name}][${task.object}]:[${task.operation}] ${_bulkResult.length - errorRecords.length} record(s) have been successfully processed. | ${errorRecords.length} record(s) have been failed.`);
        
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

  private async bulkQuery(task: Task ): Promise<any> {

		let records = [];
		this.sourceConn.bulk.pollTimeout = POLL_TIMEOUT;
		this.sourceConn.bulk.pollInterval = POLL_INTERVAL;

		return new Promise<any>((resolve, reject) => {
			this.sourceConn.bulk.query(task.query).on('record', (rec) => {
				records.push(rec);
			})
			.on('error', (err: any) => { 
        this.ux.error(err);
        reject(err) 
      })
			.on('end', () => {
				resolve(records);
			});
		})
  }
  
  private async bulkImport(task: Task, records: Array<object>): Promise<object> {

		this.targetConn.bulk.pollTimeout = POLL_TIMEOUT;
    this.targetConn.bulk.pollInterval = POLL_INTERVAL;
    
		var options:BulkOptions =  {
			concurrencyMode: CONCURRENCY_MODE,
			extIdField: task.operation == 'upsert' ? task.externalId : undefined
		}

		return new Promise<object>((resolve, reject) => {
			this.targetConn.bulk.load(task.object, task.operation, options, records, (err, res) => {
				if (err) {
					reject(err)
				}		
				resolve(res);
			});
		})
  }
  
}
