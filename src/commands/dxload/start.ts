import { flags, SfdxCommand, FlagsConfig } from '@salesforce/command';
import { Messages, Org, SfdxProject, SfdxError  } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';

import { Task } from '../../model/task';
import { Job } from '../../model/job';

import * as fs from 'fs';
import * as path from 'path';
import { isNullOrUndefined } from 'util';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('dxload', 'org');

export default class start extends SfdxCommand {

  
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
  protected static requiresProject = true;

  
  public async run(): Promise<AnyJson> {
   
    const sourceOrgUserNameOrAlias = this.flags.sourceusername || '';
    const taskname:Array<string> = this.flags.taskname;
    const configFilePath = this.flags.configpath;

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const targetOrg = this.org;
    const targetOrgConnection = targetOrg.getConnection();
    const sourceOrg: Org = await Org.create({ aliasOrUsername:sourceOrgUserNameOrAlias });
    const sourceOrgConnection = sourceOrg.getConnection();

    
    let projectPath = './';
    
    if(this.project){
      projectPath = this.project.getPath();
    }else{
      try{
        let project = await SfdxProject.resolve();
        projectPath = project.getPath();
      }catch(err){
          throw new SfdxError('No SFDX project!')
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
    
    let response = await Promise.all(
      tasks.map(async task => {
        this.ux.startSpinner(task.name)
        let result = await Job.runTask(task,sourceOrgConnection,targetOrgConnection)
        this.ux.stopSpinner();
        return result;
      })
    )
    // Return an object to be displayed with --json
    return response;
  }

}
