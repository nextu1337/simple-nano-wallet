**Simple Nano Wallet**
# WORK IN PROGRESS, WILL BE DONE SOON
Simple nano wallet with in memory key managment. Originally made by [Nanswap Nodes](https://nanswap.com/nodes), rewritten in typescript and added some features.
Rewritten by [nx2](https://github.com/nextu1337)

**Core Features**
- Easily send and receive nano with local signature
- Use your own node or any node provider
- Auto receive blocks of wallet accounts with websocket
- Receive all receivable blocks for an account
- Create wallet from seed or from random entropy
- Create derived accounts
- Suppport custom prefix & decimal for custom network such as Banano or DogeNano

**New Features**
- Typescript support & refactored code
- Allow multiple nodes for RPC & Work servers for failover

**Installation**  
Using npm
```bash
npm install simple-nano-wallet
```
Using yarn
```bash
yarn add simple-nano-wallet
```

**Usage:**  
**Create new wallet**
```ts
import { Wallet } from 'simple-nano-wallet';
import { wallet as walletLib} from 'multi-nano-web';

const seed = walletLib.generateLegacy().seed // save & backup it somewhere!

// initialize wallet
const wallet = new Wallet({
    RPC_URL: 'http://127.0.0.1:7076', // if you have multiple nodes, you can provide an array of nodes
    WORK_URL: ['http://127.0.0.1:7076', 'https://fallback-node.com'], // multiple nodes for failover, singular node passed as string is also valid
    WS_URL: `ws://127.0.0.1:7078`,
    defaultRep: "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
    seed,
});

// Generate 10 derived accounts
const accounts = wallet.createAccounts(10)
// ["nano_3g5hpb4kwqgakt4cx11ftq6xztx1matfhgkmhunj3sx4f4s3nwb6hfi3nts1", ... ]
```

**Auto Receive**  
By default, when a websocket is provided, receivable blocks for all wallet accounts will be processed automatically.  
To disable this feature, set `autoReceive` to false when initializing the wallet.  

**Manually Receive**  
```ts
// receive all receivable blocks for an account
const hashesReceive = await wallet.receiveAll("nano_3g5hpb4kwqgakt4cx11ftq6xztx1matfhgkmhunj3sx4f4s3nwb6hfi3nts1")
```

**Send**  
```ts
// send 0.001 nano from nano_3g5hp... to nano_3g5hp...
const hash = await wallet.send({
    source: "nano_3g5hpb4kwqgakt4cx11ftq6xztx1matfhgkmhunj3sx4f4s3nwb6hfi3nts1", // IMPORTANT: must be in wallet. 
    destination: "nano_3g5hpb4kwqgakt4cx11ftq6xztx1matfhgkmhunj3sx4f4s3nwb6hfi3nts1",
    amount: wallet.megaToRaw(0.001),
})
        
```

**Custom networks**
```ts
const headerAuth = { // custom header for authentification
     "nodes-api-key": process.env.NODES_API_KEY
}

// DogeNano Wallet
const walletXDG = new Wallet({
    RPC_URL: 'https://nodes.nanswap.com/XDG',
    WORK_URL: 'https://nodes.nanswap.com/XDG',
    WS_URL: `wss://nodes.nanswap.com/ws/?ticker=XDG&api=${process.env.NODES_API_KEY}`,
    seed: seedXDG,
    defaultRep: "xdg_1e4ecrhmcws6kwiegw8dsbq5jstq7gqj7fspjmgiu11q55s6xnsnp3t9jqxf",
    prefix: 'xdg_',
    decimal: 26,
    customHeaders: headerAuth,
    wsSubAll: false, 
})
// Banano Wallet
const walletBAN = new Wallet({
            RPC_URL: 'https://nodes.nanswap.com/BAN',
            WORK_URL: 'https://nodes.nanswap.com/BAN',
            WS_URL: `wss://nodes.nanswap.com/ws/?ticker=BAN&api=${process.env.NODES_API_KEY}`,
            seed: seedBAN,
            defaultRep: "ban_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
            prefix: 'ban_',
            decimal: 29,
            customHeaders: headerAuth,
            wsSubAll: false
        })
```
Despite the rewrite, this lib is **still** intended for small project (<5000 accounts), for a more scablable system, it is recommended to use a database to store the accounts keys.
