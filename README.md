sfdx dxloader plugin
=================

## ` sfdx dxload:start [-p <string>] [-u <string>] [-s <string>] [-t <array>] [--json] `

```
USAGE
  $ sfdx dxload:start [-p <string>] [-u <string>] [-s <string>] [-t <array>] [--json] 

OPTIONS
  -p, --configpath                              the path of the configuration yaml file,
                                                default: dxloader-config.yaml
  -t, --taskname=nameofthetask                  Supports comma seperated taskname.
                                                If it is not defined, it runs all tasks specified in the 
                                                yaml config file
                                                
  -u, --targetusername=targetusername           username or alias for the target

  -s, --sourceusername=sourceusername           username or alias for the source org

  --json                                        format output as json

EXAMPLES
  $ sfdx dxload:start --targetusername myTargetOrg@username.com --sourceusername mySourceOrg@username.com
  $ sfdx dxload:start -u myTargetOrg@username.com -s mySourceOrg@username.com -p myloader-config.yaml
  $ sfdx dxload:start -u targetAlias -s sourceAlias -p dataloader/dxloader.yaml -t task1,task2,task3 --json
```

## Configuration Yaml
```
project: SFDX Data Loader
version: 1.0
tasks:
- name: account_upsert_task                             # taskname can be defined by (-t | --taskname) flags
  object: Account                                       # source and target object must be same
  operation: upsert                                     # operation: insert|update|upsert|delete
  externalId: custom_externalId__c                      # required for upsert operations
  query: Select Id,Name,Type,custom_externalId__c,custom_parent__r.ExternalId__c From Account Where BillingState!=NULL
  map:                                                  #sourceField: targetField (Field mapping)
    custom_externalId__c: custom_externalId__c
    Name: Name
    Type: Type
    custom_parent__r.ExternalId__c: custom_parent__r.ExternalId__c
    
- name: contact_update_task 
  object: Contact
  operation: update
  query: Select Id,FirstName,LastName From Contact Limit 5
  map:
    FirstName: FirstName
    LastName: LastName
    Id: Id
```