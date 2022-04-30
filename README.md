# bfx-challenge
The BFX technical challenge

## Getting Started

**Clone projet**

```
git clone https://github.com/jkdamilola/bfx-challenge.git
```

**Install Project Dependencies**

Download all project dependencies.

```
npm install
```

### Setting up the DHT

```
npm i -g grenache-grape
```

```
# boot two grape servers

grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'
```

### Setting up Grenache in your project

```
npm install --save grenache-nodejs-http
npm install --save grenache-nodejs-link
```


## Start the exchange instances

You can start up multiple instances of the exchange service in multiple terminals.

```
npm start
```

## Done
[x] Each client will have its own instance of the orderbook.

[x] Clients submit orders to their own instance of orderbook. The order is distributed to other instances, too.

[x] If a client's order matches with another order, any remainer is added to the orderbook, too.

[x] Used Grenache to communicate between nodes.

[x] Simple order matching engine.

## Todo

[ ] Handle race conditions by possibly using a Redlock or Mutex architecture

[ ] To improve efficiency, optimize order matching algorithm by sorting the `orders` array then using binary search to find the closest match.

[ ] Unit tests (No TDD).

[ ] Refactor using Typescript.