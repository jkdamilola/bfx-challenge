const { ulid } = require("ulid");

class Order {
    static type = {
        BUY: 'BUY',
        SELL: 'SELL'
    }

    constructor({ id, type, amount, clientId }) {
        this.id =  id || `order_${ulid()}`;
        this.type = type;
        this.amount = amount;
        this.ownedBy = clientId;
        this.isLocked = true;
        this.lockedBy = clientId;
    }
}

module.exports = Order;