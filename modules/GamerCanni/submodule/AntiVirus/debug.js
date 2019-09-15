const readline = require('readline');
const AntiVirus = require("./antiVirus");
const Tools = require("../../../../lib/Tools");



const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout
});

AntiVirus.debug(true);
AntiVirus.start();

msg = {"author":{"id":12345678}};

function rec() {
    rl.question("-->", (answer => {
        AntiVirus.input(msg, answer);
        rec();
    }));
}

rec();