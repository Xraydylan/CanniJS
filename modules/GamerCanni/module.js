"use strict";

// @IMPORTS
const Application = require("../../lib/Application");
const Module = require("../../lib/Module");
const Promise = require("bluebird");
const Tools = require("../../lib/Tools");
const AntiVirus = require("./submodule/AntiVirus/antiVirus");
var active_AV = false;

module.exports = class RockPaperScissors extends Module {
    start() {
        return new Promise((resolve, reject) => {
            this.log.debug("Starting...");

            AntiVirus.start();

            Application.modules.Discord.client.on('message', (msg) => {
                if (msg.author.bot) {
                    return;
                }

                if (Application.modules.Discord.isUserBlocked(msg.author.id)) {
                    return;
                }

                if (Application.modules.Discord.isMessageSent()) {
                    return;
                }

                if (msg.isMemberMentioned(Application.modules.Discord.client.user)) {
                    if (Tools.msg_contains(msg, 'let\'s play a game') || Tools.msg_contains(msg, 'let’s play a game')) {
                        if (Application.modules.Discord.controlTalkedRecently(msg, this.config.playGameType)) {
                            return this.letsPlay(msg);
                        }
                    }
                    if (Tools.msg_starts_mentioned(msg, "deactivate antivirus")) {
                        return this.stop_antivirus(msg);
                    } else if (Tools.msg_starts_mentioned(msg, "activate antivirus")) {
                        return this.start_antivirus(msg);
                    }
                }

                if (active_AV) {
                    if (Tools.msg_starts(msg,"-"))
                    {
                        return AntiVirus.input(msg, msg.content.substring(1))
                    }
                }
            });

            return resolve(this);
        });
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    reactMultiple(msg, emojis) {
        if (!emojis.length) {
            return Promise.resolve();
        }
        msg.react(emojis[0]);
        return this.sleep(300).then(() => this.reactMultiple(msg, emojis.slice(1)));
    }

    getEmojiName(emoji) {
        switch (emoji) {
            case '👊':
                return 'rock';
            case '🖐':
                return 'paper';
            case '✌':
                return 'scissors';
            case '🦎':
                return 'lizard';
            case '🖖':
                return 'Spock';
            default:
                return emoji;
        }
    }

    letsPlay(msg, flavourText = null, gameType = null) {
        this.log.info('started playing game');

        if (flavourText === null) {
            flavourText = this.config.playGameAnswer;
        }

        if (gameType === null) {
            gameType = Math.random() < 0.5 ? "rps" : "rpsls";
        }

        let emojis, gameName;
        switch (gameType) {
            case "rps":
                emojis = ['👊', '🖐', '✌'];
                gameName = this.config.playTypeRPS;
                break;
            case "rpsls":
                emojis = ['👊', '🖐', '✌', '🦎', '🖖'];
                gameName = this.config.playTypeRPSLS;
                break;
            default:
                return;
        }

        const canniChoice = this.getEmojiName(emojis[Math.floor(Math.random() * emojis.length)]);

        msg.channel.send(Tools.parseReply(flavourText, [msg.author, gameName, Application.modules.Discord.getEmoji('excited')])).then(sentEmbed => {
            this.reactMultiple(sentEmbed, emojis);

            const filter = (reaction, user) => {
                return emojis.includes(reaction.emoji.name) && user.id === msg.author.id;
            };

            sentEmbed.awaitReactions(filter, { max: 1, time: 30000, errors: ['time'] }).then(collected => {
                const reaction = collected.first();

                const userChoice = this.getEmojiName(reaction.emoji.name);
                this.play(msg, userChoice, canniChoice, emojis);
                this.log.info('User chose ' + userChoice);
            }).catch(() => {
                this.log.info('User decided not to play');
                msg.reply(Tools.parseReply(this.config.didNotPlayAnswer, [Application.modules.Discord.getEmoji('shy')]));
            });
        });

        Application.modules.Discord.setMessageSent();
    }

    play(msg, userChoice, canniChoice, choices) {
        let result;
        if (userChoice === canniChoice) {
            result = 'tie';
        } else if (userChoice === "rock") {
            if (canniChoice === "scissors" || canniChoice == "lizard") {
                result = "playerWin";
            } else {
                result = "canniWin";
            }
        } else if (userChoice === "paper") {
            if (canniChoice === "rock" || canniChoice == "Spock") {
                result = "playerWin";
            } else {
                result = "canniWin";
            }
        } else if (userChoice === "scissors") {
            if (canniChoice === "paper" || canniChoice == "lizard") {
                result = "playerWin";
            } else {
                result = "canniWin";
            }
        } else if (userChoice === "lizard") {
            if (canniChoice === "paper" || canniChoice == "Spock") {
                result = "playerWin";
            } else {
                result = "canniWin";
            }
        } else if (userChoice === "Spock") {
            if (canniChoice === "scissors" || canniChoice == "rock") {
                result = "playerWin";
            } else {
                result = "canniWin";
            }
        }

        return this.resultMessage(msg, canniChoice, result);
    }

    resultMessage(msg, canniChoice, result) {
        switch (result) {
            case 'tie':
                msg.channel.send(Tools.parseReply(this.config.tieMessage, [msg.author, canniChoice, Application.modules.Discord.getEmoji('hello')]));
                break;
            case 'playerWin':
                msg.channel.send(Tools.parseReply(this.config.playerWinMessage, [msg.author, canniChoice, Application.modules.Discord.getEmoji('bizaam')]));
                break;
            case 'canniWin':
                msg.channel.send(Tools.parseReply(this.config.canniWinMessage, [msg.author, canniChoice, Application.modules.Discord.getEmoji('smile')]));
                break;
        }

        Application.modules.Discord.setMessageSent();
    }

    start_antivirus(msg) {
        if (active_AV) {
            msg.channel.send(Tools.parseReply(this.config.ans_AV_active));
        } else {
            active_AV = true;
            msg.channel.send(Tools.parseReply(this.config.ans_activate_AV));
        }
        Application.modules.Discord.setMessageSent();
    }

    stop_antivirus(msg) {
        if (active_AV) {
            active_AV = false;
            msg.channel.send(Tools.parseReply(this.config.ans_deactivate_AV));
        } else {
            msg.channel.send(Tools.parseReply(this.config.ans_AV_inactive));
        }
        Application.modules.Discord.setMessageSent();
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.log.debug("Stopping...");
            return resolve(this);
        })
    }
};
