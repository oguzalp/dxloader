
import { isNullOrUndefined } from 'util'

export function mapFieldResult(fieldsMap:object,records:Array<object>){
    if(isNullOrUndefined( fieldsMap )){
      return records;
    }else{
       let mapResult = records.map( rec =>{
          var res = {}; 
          for(let key in fieldsMap){
            res[fieldsMap[key]] = rec[key];
          }
          return res;
      });
      return mapResult;
    } 
  } 

export function getTime():string{
    let date = new Date();
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}