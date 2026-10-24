const acorn=require('acorn'),walk=require('acorn-walk'),assert=require('node:assert/strict');
class Patch {
 constructor(name,source){this.name=name;this.source=source;this.edits=[];this._ast=null;}
 get ast(){return this._ast??=acorn.parse(this.source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true});}
 functions(name){return this.nodes('FunctionDeclaration').filter(n=>n.id?.name===name);}
 function(name){const a=this.functions(name);assert.equal(a.length,1,`${this.name}: function ${name} must be unique (${a.length})`);return a[0];}
 nodes(type){if(!this._byType){this._byType=new Map;walk.full(this.ast,n=>{let a=this._byType.get(n.type);if(!a)this._byType.set(n.type,a=[]);a.push(n);});}return this._byType.get(type)||[];}
 text(node){return this.source.slice(node.start,node.end);}
 replace(start,end,text,label){assert.ok(Number.isInteger(start)&&end>=start&&end<=this.source.length);this.edits.push({start,end,text,label});}
 once(old,text,label){let at=this.source.indexOf(old);assert.ok(at>=0,`${this.name}: missing ${label||old.slice(0,60)}`);assert.equal(this.source.indexOf(old,at+1),-1,`${this.name}: ambiguous ${label||old.slice(0,60)}`);this.replace(at,at+old.length,text,label);}
 all(old,text,label,{min=1,max=Infinity}={}){let count=0,at=0;while((at=this.source.indexOf(old,at))>=0){this.replace(at,at+old.length,text,label);at+=old.length;count++;}assert.ok(count>=min&&count<=max,`${this.name}: ${label} count ${count}`);return count;}
 body(name,body,label){const n=this.function(name);this.replace(n.body.start+1,n.body.end-1,body,label||`disable ${name}`);}
 replaceFunction(name,text,label){const n=this.function(name);this.replace(n.start,n.end,text,label||`replace ${name}`);}
 render(){const sorted=[...this.edits].sort((a,b)=>a.start-b.start);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i-1].end<=sorted[i].start,`${this.name}: overlapping ${sorted[i-1].label} and ${sorted[i].label}`);let s=this.source;for(const e of sorted.reverse())s=s.slice(0,e.start)+e.text+s.slice(e.end);return s;}
}
module.exports={Patch,walk};
