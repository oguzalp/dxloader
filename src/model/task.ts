
import { BulkLoadOperation } from 'jsforce';

export interface Task {
    name: string,
    query: string,
    operation: BulkLoadOperation, 
    object:string,
    externalId?: string,
    sequence?: number,
    map?: object
}