#!/usr/bin/env node

const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
require('dotenv').config();
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');

// ======================== 终极内存限制 ========================
// 强制压榨底层独立 Go 进程的内存空间，通过环境变量传递给子进程
process.env.GOGC = '20';          
process.env.GOMEMLIMIT = '20MiB'; 
// ==============================================================

const UPLOAD_URL = process.env.UPLOAD_URL || '';      
const PROJECT_URL = process.env.PROJECT_URL || '';    
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; 
const YT_WARPOUT = false; // 强制关闭 WARP 出站以节省内存
const FILE_PATH = process.env.FILE_PATH || '.npm';    
const SUB_PATH = process.env.SUB_PATH || 'sub';       
const UUID = process.env.UUID || '14e709cd-142b-4e9f-b0a6-cf0e4c14da66';  
const NEZHA_SERVER = ''; // 强制禁用哪吒
const NEZHA_PORT = '';             
const NEZHA_KEY = '';               
const ARGO_DOMAIN = '';           
const ARGO_AUTH = '';               
const ARGO_PORT = 59001;             
const S5_PORT = '';                   
const TUIC_PORT = '';               
const HY2_PORT = process.env.HY2_PORT || '6028';     // 仅保留 HY2 端口            
const ANYTLS_PORT = '';           
const REALITY_PORT = '';         
const ANYREALITY_PORT = '';   
const CFIP = process.env.CFIP || 'saas.sin.fan';             
const CFPORT = process.env.CFPORT || 443;                    
const PORT = process.env.PORT || 3000;                       
const NAME = process.env.NAME || 'VM';                         
const CHAT_ID = process.env.CHAT_ID || '8093926960';                   
const BOT_TOKEN = process.env.BOT_TOKEN || '8396677288:AAGCpsBEDOjKkQuuNZgk7U3xanOsKS2M6U8';               
const DISABLE_ARGO = true; // 强制禁用 Argo

//创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

// 生成随机6位字符函数
function generateRandomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成随机名称
const webRandomName = generateRandomName();

// 使用随机文件名定义路径
let webPath = path.join(FILE_PATH, webRandomName);
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;

    let fileContent;
    try { fileContent = fs.readFileSync(subPath, 'utf-8'); } catch { return null; }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line => 
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    return axios.post(`${UPLOAD_URL}/api/delete-nodes`, 
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch(() => null);
  } catch (err) {
    return null;
  }
}

// 端口验证函数
function isValidPort(port) {
  try {
    if (port === null || port === undefined || port === '') return false;
    if (typeof port === 'string' && port.trim() === '') return false;
    const portNum = parseInt(port);
    if (isNaN(portNum)) return false;
    if (portNum < 1 || portNum > 65535) return false;
    return true;
  } catch (error) {
    return false;
  }
}

//清理历史文件
const pathsToDelete = [ 'boot.log', 'list.txt'];
function cleanupOldFiles() {
  pathsToDelete.forEach(file => {
    const filePath = path.join(FILE_PATH, file);
    fs.unlink(filePath, () => {});
  });
}

// 判断系统架构
function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    return 'arm';
  } else {
    return 'amd';
  }
}

// 下载对应系统架构的依赖文件
function downloadFile(fileName, fileUrl, callback) {
  const filePath = path.join(FILE_PATH, fileName);
  const writer = fs.createWriteStream(filePath);

  axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
      response.data.pipe(writer);
      writer.on('finish', () => {
        writer.close();
        console.log(`Download ${fileName} successfully`);
        callback(null, fileName);
      });
      writer.on('error', err => {
        fs.unlink(filePath, () => { });
        callback(`Download ${fileName} failed: ${err.message}`);
      });
    }).catch(err => {
      callback(`Download ${fileName} failed: ${err.message}`);
    });
}

// 下载并运行依赖文件
async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  
  // 仅下载 sing-box (web) 核心
  const fileUrl = architecture === 'arm' ? "https://arm64.ssss.nyc.mn/sb" : "https://amd64.ssss.nyc.mn/sb";
  
  try {
    await new Promise((resolve, reject) => {
      downloadFile(webRandomName, fileUrl, (err, fileName) => {
        if (err) reject(err);
        else resolve(fileName);
      });
    });
  } catch (err) {
    console.error('Error downloading files:', err);
    return;
  }

  // 授权文件
  const absoluteFilePath = path.join(FILE_PATH, webRandomName);
  if (fs.existsSync(absoluteFilePath)) {
    fs.chmodSync(absoluteFilePath, 0o775);
    console.log(`Empowerment success for ${absoluteFilePath}`);
  }

  // 生成 TLS 证书 (Hysteria2 必须)
  await setupTlsCertificates();
}

async function setupTlsCertificates() {
  const privKeyPath = path.join(FILE_PATH, 'private.key');
  const certPath = path.join(FILE_PATH, 'cert.pem');

  if (!fs.existsSync(privKeyPath) || !fs.existsSync(certPath)) {
    try {
      await execPromise(`openssl ecparam -genkey -name prime256v1 -out "${privKeyPath}"`);
      await execPromise(`openssl req -new -x509 -days 3650 -key "${privKeyPath}" -out "${certPath}" -subj "/CN=bing.com"`);
    } catch (err) {
      // Fallback
      const privateKeyContent = `-----BEGIN EC PARAMETERS-----\nBggqhkjOPQMBBw==\n-----END EC PARAMETERS-----\n-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIM4792SEtPqIt1ywqTd/0bYidBqpYV/++siNnfBYsdUYoAoGCCqGSM49\nAwEHoUQDQgAE1kHafPj07rJG+HboH2ekAI4r+e6TL38GWASANnngZreoQDF16ARa\n/TsyLyFoPkhLxSbehH/NBEjHtSZGaDhMqQ==\n-----END EC PRIVATE KEY-----`;
      const certContent = `-----BEGIN CERTIFICATE-----\nMIIBejCCASGgAwIBAgIUfWeQL3556PNJLp/veCFxGNj9crkwCgYIKoZIzj0EAwIw\nEzERMA8GA1UEAwwIYmluZy5jb20wHhcNMjUwOTE4MTgyMDIyWhcNMzUwOTE2MTgy\nMDIyWjATMREwDwYDVQQDDAhiaW5nLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEH\nA0IABNZB2nz49O6yRvh26B9npACOK/nuky9/BlgEgDZ54Ga3qEAxdegEWv07Mi8h\naD5IS8Um3oR/zQRIx7UmRmg4TKmjUzBRMB0GA1UdDgQWBBTV1cFID7UISE7PLTBR\nBfGbgkrMNzAfBgNVHSMEGDAWgBTV1cFID7UISE7PLTBRBfGbgkrMNzAPBgNVHRMB\nAf8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIAIDAJvg0vd/ytrQVvEcSm6XTlB+\neQ6OFb9LbLYL9f+sAiAffoMbi4y/0YUSlTtz7as9S8/lciBF5VCUoVIKS+vX2g==\n-----END CERTIFICATE-----`;
      fs.writeFileSync(privKeyPath, privateKeyContent);
      fs.writeFileSync(certPath, certContent);
    }
  }

  // 极简生成sb配置文件 (仅 Hysteria2)
  const config = {
    "log": { "disabled": true, "level": "error", "timestamp": true },
    "inbounds": [],
    "outbounds": [{ "type": "direct", "tag": "direct" }],
    "route": { "final": "direct" }
  };

  if (isValidPort(HY2_PORT)) {
    config.inbounds.push({
      "tag": "hysteria-in",
      "type": "hysteria2",
      "listen": "::",
      "listen_port": parseInt(HY2_PORT),
      "users": [{ "password": UUID }],
      "masquerade": "https://bing.com",
      "tls": {
        "enabled": true,
        "alpn": ["h3"],
        "certificate_path": certPath,
        "key_path": privKeyPath
      }
    });
  }

  fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));

  // 运行独立二进制 sing-box，此时 Node.js 进程会将顶部的 GOMEMLIMIT 环境变量传递给子进程
  const command1 = `nohup ${path.join(FILE_PATH, webRandomName)} run -c ${path.join(FILE_PATH, 'config.json')} >/dev/null 2>&1 &`;
  try {
    await execPromise(command1);
    console.log('web is running');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`web running error: ${error}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  await extractDomains();
}

// 执行命令的Promise封装
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

// 获取临时隧道domain (已禁用，直接生成直连链接)
async function extractDomains() {
  await generateLinks(null);
}

// 获取isp信息
async function getMetaInfo() {
  try {
    const response1 = await axios.get('https://api.ip.sb/geoip', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 }});
    if (response1.data && response1.data.country_code && response1.data.isp) {
      return `${response1.data.country_code}-${response1.data.isp}`.replace(/\s+/g, '_');
    }
  } catch (error) { }
  return 'Unknown';
}

// 生成 list 和 sub 信息
async function generateLinks(argoDomain) {
  let SERVER_IP = '127.0.0.1';
  try {
    const ipv4Response = await axios.get('http://ipv4.ip.sb', { timeout: 3000 });
    SERVER_IP = ipv4Response.data.trim();
  } catch (err) {
    // 忽略错误，防止频繁尝试导致高内存
  }

  const ISP = await getMetaInfo();
  const nodeName = NAME ? `${NAME}-${ISP}` : ISP;
  
  return new Promise((resolve) => {
    setTimeout(() => {
      let subTxt = '';

      // 仅生成 HY2 节点
      if (isValidPort(HY2_PORT)) {
        subTxt += `hysteria2://${UUID}@${SERVER_IP}:${HY2_PORT}/?sni=www.bing.com&insecure=1&alpn=h3&obfs=none#${nodeName}`;
      }

      console.log('\x1b[32m' + Buffer.from(subTxt).toString('base64') + '\x1b[0m'); 
      console.log('\x1b[35m' + 'Logs will be deleted in 90 seconds,you can copy the above nodes' + '\x1b[0m'); 
      fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
      fs.writeFileSync(listPath, subTxt, 'utf8');
      
      sendTelegram(); 
      uplodNodes(); 
      
      app.get(`/${SUB_PATH}`, (req, res) => {
        const encodedContent = Buffer.from(subTxt).toString('base64');
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(encodedContent);
      });
      resolve(subTxt);
    }, 1000);
  });
}
  
// 90s分钟后删除相关文件
function cleanFiles() {
  setTimeout(() => {
    const filesToDelete = [bootLogPath, configPath, listPath, webPath];  
    const filePathsToDelete = filesToDelete.map(file => {
      if (file === webPath) return file;
      return path.join(FILE_PATH, path.basename(file));
    });

    exec(`rm -rf ${filePathsToDelete.join(' ')} >/dev/null 2>&1`, (error) => {
      console.clear();
      if (global.gc) global.gc(); // 强制回收初始化的内存
      console.log('App is running');
      console.log('Thank you for using this script, enjoy!');
    });
  }, 90000); 
}

async function sendTelegram() {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
      const message = fs.readFileSync(path.join(FILE_PATH, 'sub.txt'), 'utf8');
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const escapedName = NAME.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const params = { chat_id: CHAT_ID, text: `**${escapedName}节点推送通知**\n\`\`\`${message}\`\`\``, parse_mode: 'MarkdownV2' };
      await axios.post(url, null, { params });
  } catch (error) {}
}

async function uplodNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subscriptionUrl = `${PROJECT_URL}/${SUB_PATH}`;
    try { await axios.post(`${UPLOAD_URL}/api/add-subscriptions`, { subscription: [subscriptionUrl] }, { headers: { 'Content-Type': 'application/json' } }); } catch (error) { }
  } 
}

async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) return;
  try { await axios.post('https://keep.gvrander.eu.org/add-url', { url: PROJECT_URL }, { headers: { 'Content-Type': 'application/json' } }); } catch (error) { }
}

async function startserver() {
  deleteNodes();
  cleanupOldFiles();
  await downloadFilesAndRun();
  await AddVisitTask();
  cleanFiles();
}
startserver();

app.get("/", async function(req, res) {
  res.send(`Hello world!<br><br>You can access /${SUB_PATH}(Default: /sub) get your nodes!`);
});

app.listen(PORT, () => console.log(`server is running on port:${PORT}!`));

// ======================== 持续内存回收 ========================
setInterval(() => {
  if (global.gc) {
    global.gc();
  }
}, 30000);
