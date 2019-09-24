const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Item = require('./item');
const Weapon = require('./weapon');

module.exports = class Shop {
    constructor(load, data) {
        if(load) {
            this.name = data.name;
            this.id = data.id;
            this.lv = data.lv;
            this.categories = data.categories;

            this.type = "shop";

            this.info_on_enter = data.info_on_enter;

            this.load_shopitems(data.items);
            this.load_shopweapons(data.weapons);
            this.category_selector();
        } else {
            this.name = data.name;
            this.id = data.id;
            this.lv = data.lv;
            this.categories = data.categories;

            this.type = "shop";

            this.info_on_enter = data.info_on_enter;
            this.shopitems = data.shopitems;
            this.item_selector();
            this.shopweapons = data.shopweapons;
            this.weapon_selector();
            this.category_selector();
        }
    }

    load_shopitems(list) {
        let pre = [];
        list.forEach(id => {
            pre.push(Item.get_item_by_id(id));
        });
        this.shopitems = pre;
        this.item_selector();
    }

    load_shopweapons(list) {
        let pre = [];
        list.forEach(id => {
            pre.push(Weapon.get_weapon_by_id(id));
        });
        this.shopweapons = pre;
        this.weapon_selector();
    }

    item_selector() {
        let sel = "";
        let count = 1;

        if (this.shopitems.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_items_in_shop, [this.name]);
            this.item_count = count - 1;
        } else {
            this.shopitems.forEach(item => {
                sel += Tools.parseReply(AV.config.selector_pattern_shopitems, [count, item.name, item.value]);
                count += 1;
            });
            this.item_count = count - 1;
        }
        this.selector_item = sel;
    }

    weapon_selector() {
        let sel = "";
        let count = 1;

        if (this.shopweapons.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_weapons_in_shop, [this.name]);
            this.weapon_count = count - 1;
        } else {
            this.shopweapons.forEach(weapon => {
                sel += Tools.parseReply(AV.config.selector_pattern_shopweapons, [count, weapon.name, weapon.value]);
                count += 1;
            });
            this.weapon_count = count - 1;
        }
        this.selector_weapon = sel;
    }

    category_selector() {
        let sel = "";
        let count = 1;

        if (this.shopitems.length <= 0 && this.shopweapons.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_items_in_shop, [this.name]);
            this.category_count = count - 1;
        } else {
            this.categories.forEach(cat => {
                sel += Tools.parseReply(AV.config.selector_pattern_category, [count, cat.name]);
                count += 1;
            });
            this.category_count = count - 1;
        }
        this.selector_category = sel;
    }

    category_message(cat) {
        if (cat === "i") {
            return AV.config.category_message_items + this.selector_item;
        } else if (cat === "w") {
            return AV.config.category_message_weapons + this.selector_weapon;
        }
        return "";
    }
};