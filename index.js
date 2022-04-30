const { PeerRPCServer, PeerRPCClient } = require("grenache-nodejs-http");
const Link = require("grenache-nodejs-link");

const OrderBook = require("./services/order-book");
const Commands = require("./commands");
const Order = require("./models/Order");

const link = new Link({
    grape: "http://127.0.0.1:30001",
});
link.start();

const peerServer = new PeerRPCServer(link, {
    timeout: 300000,
});
peerServer.init();

const peerClient = new PeerRPCClient(link, {});
peerClient.init();

const port = 1024 + Math.floor(Math.random() * 2000);
const service = peerServer.transport("server");
service.listen(port);

const orderBookService = new OrderBook({ peerClient, clientId: port });

service.on("request", async (rid, key, payload, handler) => {
    const { data, clientId } = payload;
    console.log(key, clientId, port);

    if (clientId === port) {
        handler.reply(null, {
            success: true,
        });
        return;
    }

    console.log(key, clientId, port);

    switch (key) {
        case Commands.SYNC_ORDERS:
            handler.reply(null, {
                success: true,
                orders: orderBookService.getOrders(),
            });
            break;
        case Commands.UPDATE_ORDER:
            if (!data.matched.updated) {
                orderBookService.deleteOrder(data.matched.original);
            }

            if (!data.order.updated) {
                orderBookService.deleteOrder(data.order.original);
            }

            if (data.matched.updated) {
                orderBookService.updateOrder(data.matched.updated);
            }

            if (data.order.updated) {
                orderBookService.updateOrder(data.order.updated);
            }
            handler.reply(null, { success: true });
            break;
        case Commands.PUBLISH_ORDER:
            orderBookService.addOrder(data);
            handler.reply(null, { success: true });
            break;
        case Commands.LOCK_ORDER:
            try {
                orderBookService.lockOrder(data);
                handler.reply(null, { success: true });
            } catch (err) {
                handler.reply(null, { success: false });
            }
            break;
        default:
            debug(`Unknown request type: ${key}`);
    }
});

const createNewOrderAtInterval = async () => {
    const random = Math.random();
    const delay = 10000 + Math.floor(random * 9000);

    try {
        const amount = parseFloat((10000 + random * 100).toFixed(2));
        const type = random < 0.5 ? Order.type.BUY : Order.type.SELL;
        await orderBookService.processNewOrder(
            new Order({ type, amount, clientId: port })
        );
    } catch (err) {
        console.error("submitNewOrder error:", err);
    }

    setTimeout(createNewOrderAtInterval, delay);
};

//Start Client
(async () => {
    try {
        setInterval(() => {
            link.announce(Commands.UPDATE_ORDER, service.port, {});
            link.announce(Commands.PUBLISH_ORDER, service.port, {});
            link.announce(Commands.SYNC_ORDERS, service.port, {});
            link.announce(Commands.LOCK_ORDER, service.port, {});
        }, 1000);

        await orderBookService.syncOrders();

        createNewOrderAtInterval();
    } catch (e) {
        console.error("Error while starting trading client", e);
        process.exit(1);
    }
})();

//Handler to stop announcing on the grape when exiting
process.on("SIGINT", async () => {
    link.stop();

    process.exit(0);
});
