const fs = require('fs');

const data = fs.readFileSync('C:\\Users\\ntutuser-2256\\.gemini\\antigravity-ide\\brain\\81577742-c77e-4416-a6a0-b4f23818439d\\.system_generated\\logs\\transcript.jsonl', 'utf8');

const lines = data.split('\n');
lines.forEach(line => {
    if (!line) return;
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT') {
        console.log("================ USER INPUT ================");
        console.log(obj.content);
    }
});
