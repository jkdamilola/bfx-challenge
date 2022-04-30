const Commands = require("../commands");
const Order = require("../models/Order");

class OrderBook {
    orders = [];

    constructor(options = {}) {
        this.peerClient = options.peerClient;
        this.clientId = options.clientId;
    }

    async syncOrders() {
        return new Promise((resolve, reject) => {
            if (!this.peerClient) {
                reject("peerClient is not defined");
                return;
            }

            this.peerClient.request(
                Commands.SYNC_ORDERS,
                { clientId: this.clientId },
                { timeout: 10000 },
                (err, data) => {
                    if (err && err.message === "ERR_GRAPE_LOOKUP_EMPTY") {
                        resolve();
                        return;
                    }

                    if (err) {
                        reject(err);
                        return;
                    }

                    this.addOrders(data.orders);
                    resolve();
                }
            );
        });
    }

    addOrders(orders = []) {
        orders.forEach((order) => {
            this.orders.push(order);
        });
    }

    addOrder(order) {
        const length = this.orders.push(order);
        console.log('length', length);

        return length - 1;
    }

    getOrders() {
        return this.orders;
    }

    getMatchedOrder(order) {
        let matchedOrder = null;
        let matchedIndex = -1;
        let amountDiff = Number.POSITIVE_INFINITY;

        for (let index = 0; index < this.orders.length; index++) {
            const currentOrder = this.orders[index];
            console.log(currentOrder.type, order.type, currentOrder.ownedBy, order.ownedBy, currentOrder.isLocked);

            /** Skip own orders */
            if (
                currentOrder.type !== order.type ||
                currentOrder.ownedBy === order.ownedBy ||
                currentOrder.isLocked
            ) {
                continue;
            }

            const newAmountDiff = Math.abs(order.amount - currentOrder.amount);
            if (newAmountDiff < amountDiff) {
                amountDiff = newAmountDiff;
                matchedOrder = currentOrder;
                matchedIndex = index;
            }
        }

        return { index: matchedIndex, order: matchedOrder };
    }

    async processNewOrder(order) {
        if (!order || !(order instanceof Order)) {
            return;
        }

        const index = this.addOrder(order);
        console.log("Index", index);
        await this.sendMessage(Commands.PUBLISH_ORDER, order);

        const matched = this.getMatchedOrder(order);
        console.log("Matched Index", matched.index);
        if (matched.index === -1 || !matched.order) {
            console.log("No matched order found.");
            this.unlockOrderByIndex(index, order);
            return;
        }

        await this.sendMessage(Commands.LOCK_ORDER, {
            ...matched.order,
            isLocked: true,
            lockedBy: order.lockedBy,
        });

        const payload = {
            order: {
                original: order,
                updated: undefined,
            },
            matched: {
                original: matched.order,
                updated: undefined,
            },
        };

        if (matched.order.amount > this.orders[index].amount) {
            this.orders[matched.index] = {
                ...this.orders[matched.index],
                amount:
                    this.orders[matched.index].amount -
                    this.orders[index].amount,
                isLocked: false,
                lockedBy: null,
            };

            this.deleteOrderByIndex(index);

            payload.matched.updated = this.orders[matched.index];
        } else if (matched.order.amount === this.orders[index].amount) {
            this.deleteOrderByIndex(index);
            this.deleteOrderByIndex(matched.index);
        } else {
            this.orders[index] = {
                ...this.orders[index],
                amount:
                    this.orders[index].amount -
                    this.orders[matched.index].amount,
                isLocked: false,
                lockedBy: null,
            };

            this.deleteOrderByIndex(matched.index);

            payload.order.updated = this.orders[index];
        }

        await this.sendMessage(Commands.UPDATE_ORDER, payload);

        console.log("All orders are: ", this.orders.length);
    }

    updateOrder(order) {
        const index = this.orders.findIndex((o) => o.id === order.id);
        if (index === -1) {
            return;
        }

        this.orders[index] = {
            ...this.orders[index],
            ...order,
        };

        console.log("All orders are: ", this.orders.length);
    }

    deleteOrder(order) {
        const index = this.orders.findIndex((o) => o.id === order.id);
        if (index === -1) {
            return;
        }

        this.deleteOrderByIndex(index);
    }

    lockOrder(order) {
        const index = this.orders.findIndex((o) => o.id === order.id);
        if (index === -1) {
            return;
        }

        if (this.orders[index].isLocked) {
            throw new Error('Order is locked');
        }

        this.lockOrderByIndex(index, order);
    }

    unlockOrder(order) {
        const index = this.orders.findIndex((o) => o.id === order.id);
        if (index === -1) {
            return;
        }

        this.unlockOrder(index, order);

        console.log('unlockOrderByIndex', this.orders.length);
        
    }

    lockOrderByIndex(index, order) {
        this.orders[index] = {
            ...this.orders[index],
            isLocked: true,
            lockedBy: order.ownedBy,
        };

        console.log('lockOrderByIndex', this.orders.length);
    }

    unlockOrderByIndex(index, order) {
        this.orders[index] = {
            ...this.orders[index],
            isLocked: false,
            lockedBy: null,
        };

        console.log('unlockOrderByIndex', this.orders.length);
    }

    deleteOrderByIndex(index) {
        if (this.orders.length > index) {
            this.orders.slice(index, 1);
        }
    }

    async sendMessage(command, data) {
        return new Promise((resolve, reject) => {
            if (!this.peerClient) {
                reject("Client is not defined");
                return;
            }

            this.peerClient.map(
                command,
                { data, clientId: this.clientId },
                { timeout: 10000 },
                (error, data) => {
                    if (error && error.message === "ERR_GRAPE_LOOKUP_EMPTY") {
                        resolve();
                        return;
                    }

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(data);
                }
            );
        });
    }
}

module.exports = OrderBook;
