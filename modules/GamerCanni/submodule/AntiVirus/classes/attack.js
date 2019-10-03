const Tools = require("../../../../../lib/Tools");

module.exports = class Attack{
    static strike(attacker, defender) {
        let dam, p, res;
        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = attacker.atk + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = attacker.atk + p;
                break;
            }
            default : {
                console.log("battle strike type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);

        return res;
    }

    static brute(attacker, defender) {
        let dam, p, res;
        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = (2*attacker.atk+1) + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = (2*attacker.atk+1) + p;
                break;
            }
            default : {
                console.log("battle brute type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);

        return res;
    }

    static charge(attacker) {
        if (attacker.charge_on) {
            attacker.charge_count += 1;
        } else {
            attacker.charge_on = true;
            attacker.charge_count = 1;
        }
    }

    static release(attacker, defender) {
        let dam, res, charge_on;

        charge_on = attacker.charge_on;
        if (!charge_on) {
            res = Attack.strike(attacker, defender);
        } else {
            dam = Attack.release_attack_damage(attacker,defender);

            res = defender.receive_damage(dam);

            attacker.charge_on = false;
            attacker.charge_count = 0;
        }

        return [res, charge_on];
    }

    static disrupt(attacker, defender) {
        let dam, p, res, res2, charge_on, disHP;

        charge_on = defender.charge_on;

        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = (attacker.atk - attacker.lv + attacker.ini/2 - 1) + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = (attacker.atk - attacker.lv + attacker.ini/2 - 1) + p;
                break;
            }
            default : {
                console.log("battle disrupt type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);
        disHP = defender.curHP;

        if (charge_on) {
            dam = Math.floor(Attack.release_attack_damage(defender, defender) / 2);
            res2 = defender.receive_damage(dam, false);
            defender.charge_on = false;
            defender.charge_count = 0;
        }

        return [res, disHP, charge_on, res2];
    }

    static release_attack_damage(attacker, defender) {
        let dam, p, def;
        def = Math.floor(defender.def/2);
        dam = def;
        switch (attacker.type) {
            case "player": {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                    dam += attacker.atk + attacker.weapon.atk + p + attacker.lv - def;
                }
                break;
            }
            case "enemy" : {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                    dam += attacker.atk + p + attacker.lv - def;
                }
                break;
            }
            default : {
                console.log("battle release type error!");
                dam = 0;
            }
        }
        return dam;
    }
};