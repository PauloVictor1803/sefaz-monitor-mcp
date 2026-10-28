import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler } from '../netlify/functions/mcp.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map([['/','index.html'],['/monitor.js','monitor.js'],['/monitor.css','monitor.css'],['/docs','docs.html'],['/docs.html','docs.html'],['/INSTRUCOES_AGENTE.md','INSTRUCOES_AGENTE.md'],['/openapi.json','openapi.json'],['/llms.txt','llms.txt'],['/favicon.ico','favicon.ico'],['/assets/brand/icone-sefaz.svg','assets/brand/icone-sefaz.svg']]);
const port=Number(process.env.PORT||8792);
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1:'+port);
  if(req.method==='GET'&&files.has(u.pathname)){
   const file=files.get(u.pathname),ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.md':'text/markdown','.json':'application/json','.txt':'text/plain','.svg':'image/svg+xml','.ico':'image/x-icon'};
   res.writeHead(200,{'Content-Type':(mime[ext]||'application/octet-stream')+'; charset=utf-8'}).end(await readFile(path.join(root,file)));return;
  }
  if(!u.pathname.startsWith('/api/')&&u.pathname!=='/mcp'){res.writeHead(404).end('Não encontrado.');return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384){res.writeHead(413).end();return;}}
  const result=await handler({path:u.pathname,httpMethod:req.method,headers:req.headers,queryStringParameters:Object.fromEntries(u.searchParams),body:body||null},{});
  res.writeHead(result.statusCode,result.headers).end(result.body||'');
 }catch{res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Não foi possível concluir a consulta local.'}));}
}).listen(port,'127.0.0.1',()=>console.log('SEFAZ Monitor local: http://127.0.0.1:'+port));
