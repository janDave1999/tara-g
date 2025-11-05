import type { APIContext, MiddlewareNext } from "astro";


export class Middleware{
  /** Required Middleware */
  private context:APIContext;
  private next:MiddlewareNext;
  private pathList:Path[] = [];
  private groupings:{result:Response|undefined}[] = [];
  /** Stacker */

  /** Constructor */
  constructor(context:APIContext, next: MiddlewareNext){
    this.context = context;
    this.next = next;
  }

  async group(callback:(mid:Middleware)=>Promise<Response|undefined>){
    const mid = new Middleware(this.context, this.next);
    this.groupings.push({result:await callback(mid)});
  }

  path(){
    const pathWare = new Path(this.context);
    this.pathList.push(pathWare);
    return pathWare;
  }

  async fin(){
    //Prepare the result 
    for(let i = 0; i < this.pathList.length; i++){
      const result = await this.pathList[i].get();
      if(result != undefined){
        return result;
      }
    }
    return undefined;
  }

  private async groupCheck(){
    //Prepare the result 
    for(let i = 0; i < this.groupings.length; i++){
      if(this.groupings[i].result != undefined){
        return this.groupings[i].result;
      }
    }
    return undefined;
  }

  

  // Use this to run your middleware 
  async result(){
    //Check Groupings First
    const groupCheckResult = await this.groupCheck();
    if(groupCheckResult != undefined)
      return groupCheckResult;

    //Then For individual
    const singleResult =  await this.fin();

    if( singleResult == undefined ){
      return this.next();
    }else{
      return singleResult;
    }
  }
}

export type PATH_TYPE = {
  type:"include"|"exclude",
  paths: string[],
  checkingMethod: "startend"|"exact"|"wildcard"|"endswith",
};

export class Path{
  private pathList:PATH_TYPE[] = [];
  private context:APIContext
  response:Response|undefined;

  constructor(context:APIContext){
    this.context = context;
  }
  setContext(context:APIContext<Record<string, any>, Record<string, string | undefined>>){
    this.context = context;
    return this;
  }
  select(paths:string[], checkingMethod="exact" as PATH_TYPE["checkingMethod"]){
    this.pathList.push({type:"include", paths, checkingMethod});
    return this;
  }
  except(paths:string[], checkingMethod="exact" as PATH_TYPE["checkingMethod"]){
    this.pathList.push({type:"exclude", paths, checkingMethod});
    return this;
  }

  checkMatch(){
    const pathName = this.context.url.pathname;
    if(this.pathList.length < 1){
      return true;
    }
    const result = this.pathList.every((pathData)=>{
      if(pathData.paths.length < 1){
        return true;
      }
      let result = false;
      if(pathData.checkingMethod == "startend"){
        result = pathData.paths.some(path=>{
          return (new RegExp(`^${escapeToRegex(path)}.*$`)).test(pathName);
        });
      }else if(pathData.checkingMethod == "wildcard"){
        result = pathData.paths.some(path=>{
          return (new RegExp(`^${escapeToRegex(path).replace(/\\\*/g, ".*")}$`)).test(pathName);
        });
      }else if( pathData.checkingMethod == "endswith"){
        result = pathData.paths.some(path=>{
          return (new RegExp(`.*${escapeToRegex(path)}$`)).test(pathName);
        });
      }else{
        result = pathData.paths.some(path=>path==pathName);
      }

      if(pathData.type == "include"){
        return result;
      }else{
        return !result;
      }
    });
    return result;
  }

  async do(callback:(request:APIContext)=>Promise<undefined|Response>|(undefined|Response)){
    if(!this.checkMatch()){
      return undefined;
    }

    const result = callback(this.context);
    if(result instanceof Promise){
      this.response = await result;
    }else{
      this.response = result;
    }
    return result;
  }

  async get(){
    return this.response;
  }

}

//---> Utilities
function escapeToRegex(string: string){
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}