import * as NodeTest from 'node:test';
import * as NodeAssert from 'node:assert/strict';
import * as NodeFSP from 'node:fs/promises';
import * as NodeOS from 'node:os';
import * as NodePath from 'node:path';
import { connectCloud } from '../harness/cloud-setup.mjs';

NodeTest.test('reuses the matching connected Cloud Brain without reading a credential', async () => {
  const result = await connectCloud({ endpoint: 'https://brain.example/', brainId: 'remote', stateDir: '/state' }, async () => ({ workspaces: [
    { id: 'other', remote: { endpoint: 'https://other.example', brainId: 'remote', status: 'ready' } },
    { id: 'local', remote: { endpoint: 'https://brain.example', brainId: 'remote', status: 'ready' } },
  ] }));
  NodeAssert.equal(result, 'local');
});

NodeTest.test('validates the remote identity before saving and never migrates an existing local Brain', async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), 'flow-cloud-setup-'));
  try {
    const tokenFile = NodePath.join(dir, 'credential');
    await NodeFSP.writeFile(tokenFile, 'synthetic-connection-credential', { mode: 0o600 });
    const commands = [];
    const rpc = async (_, method, fields) => {
      if (method === 'state') return { workspaces: [{ id: 'existing-local' }] };
      commands.push(fields.command);
      return 'new-remote-binding';
    };
    const options = { endpoint: 'https://brain.example', brainId: 'expected', stateDir: dir, tokenFile };
    await NodeAssert.rejects(connectCloud(options, rpc, async () => Response.json({ result: { workspaces: [{ id: 'wrong' }] } })), /different Brain/);
    NodeAssert.equal(commands.length, 0);
    const result = await connectCloud(options, rpc, async (url, init) => {
      NodeAssert.equal(url.href, 'https://brain.example/v1/brain');
      NodeAssert.equal(init.redirect, 'error');
      return Response.json({ result: { workspaces: [{ id: 'expected' }] } });
    });
    NodeAssert.equal(result, 'new-remote-binding');
    NodeAssert.deepEqual(commands, [{ action: 'connectCloud', endpoint: 'https://brain.example', token: 'synthetic-connection-credential' }]);
  } finally { await NodeFSP.rm(dir, { recursive: true, force: true }); }
});

NodeTest.test('rejects insecure origins and unavailable existing connections', async () => {
  await NodeAssert.rejects(connectCloud({ endpoint: 'http://brain.example' }), /HTTPS/);
  await NodeAssert.rejects(connectCloud({ endpoint: 'https://brain.example', brainId: 'remote' }, async () => ({ workspaces: [
    { id: 'local', remote: { endpoint: 'https://brain.example', brainId: 'remote', status: 'error' } },
  ] })), /unavailable/);
});

NodeTest.test('redeems dashboard enrollment before connecting and does not send the enrollment to Brain RPC', async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), 'flow-enrollment-'));
  try {
    const enrollmentFile=NodePath.join(dir,'grant');await NodeFSP.writeFile(enrollmentFile,'one-use-fixture');
    const calls=[];
    const id=await connectCloud({endpoint:'https://brain.example',brainId:'expected',stateDir:dir,enrollmentFile},async(_,method,fields)=>{
      if(method==='state')return {workspaces:[]};
      NodeAssert.equal(fields.command.token,'connection-fixture');return 'bound';
    },async(url,init)=>{
      calls.push(url.pathname);
      if(url.pathname==='/auth/enroll'){
        NodeAssert.equal(JSON.parse(init.body).token,'one-use-fixture');
        return Response.json({token:'connection-fixture',brainId:'expected'});
      }
      NodeAssert.equal(init.headers.authorization,'Bearer connection-fixture');
      return Response.json({result:{workspaces:[{id:'expected'}]}});
    });
    NodeAssert.equal(id,'bound');NodeAssert.deepEqual(calls,['/auth/enroll','/v1/brain']);
  }finally{await NodeFSP.rm(dir,{recursive:true,force:true});}
});
