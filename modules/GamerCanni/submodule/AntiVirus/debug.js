const readline = require('readline');
const AntiVirus = require("./antiVirus");
const Tools = require("../../../../lib/Tools");



const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout
});

AntiVirus.debug(true);
AntiVirus.start();

//type != "dm"
msg = {"author":{"id":12345678}, "channel":{"id":12345, "type":"text"}};

function rec() {
    rl.question("-->", (answer => {
        AntiVirus.input(msg, answer);
        rec();
    }));
}

rec();