const SignallingOrchestrator = artifacts.require("SignallingOrchestrator");
const CollateralToken = artifacts.require("CollateralToken");
const ConditionalTokens = artifacts.require("ConditionalTokens");
const Whitelist = artifacts.require("Whitelist");
const MarketMaker = artifacts.require("MarketMaker");
const FixedMath = artifacts.require("Fixed192x64Math");
const MMFactory = artifacts.require("LMSRMarketMakerFactory");
const Ethers = require('ethers');
const utils = Ethers.utils;
// const numberToBN = require('number-to-bn');

require("./test-setup");

contract('Signalling Orchestrator', function ([owner, oracle, investor, trader]) {

  var so, mm, factory, collateral;

  const HUNDRED = web3.utils.toWei('100', 'ether');
  const ONE = web3.utils.toWei('1', 'ether');

  function getMarketIdFromTx(tx) {
    for(var i=0; i < tx.receipt.rawLogs.length; i++) {
      if (tx.receipt.rawLogs[i].address == factory.address) {
        let id = '0x' + tx.receipt.rawLogs[i].data.substring(26, 66);
        return id;
      }
    }
    return null;
  }

  step("should deploy market maker factory", async function () {
    let fixedMath = await FixedMath.new();
    console.log("Fixed math: " + fixedMath.address);
    await MMFactory.link("Fixed192x64Math", fixedMath.address);
    factory = await MMFactory.new();
    //Old way
    // await so.setMarketMakerFactory(factory.address);
    // console.log("Factory: " + factory.address);
  });


  step("should deploy orchestrator", async function () {
    var collateralToken = await CollateralToken.new();
    var conditionalTokens = await ConditionalTokens.new();
    var whitelist = await Whitelist.new();
    so = await SignallingOrchestrator.new(oracle, factory.address, collateralToken.address, conditionalTokens.address, whitelist.address, {gas: 10000000});
    let receipt = await web3.eth.getTransactionReceipt(so.transactionHash);
    console.log("Gas: " + receipt.gasUsed);
    so.should.not.null;
    let collateralAddress = await so.collateralToken.call();
    collateral = await CollateralToken.at(collateralAddress);
  });

  step("should create a market", async function () {
    let tx = await so.createMarket(utils.formatBytes32String("Kuba"), HUNDRED, "project", "outcome");
    let marketId = getMarketIdFromTx(tx);
    mm = await MarketMaker.at(marketId);
    console.log("Market id: " + marketId);
  });

  step("should get markets count", async function () {
    let count = await so.getMarketsCount();
    count.toNumber().should.be.equal(1);
  });

  step("should get market details", async function () {
    const [address, project, outcome] = await so.getMarketDetails(0);
    project.should.be.equal("project");
    outcome.should.be.equal("outcome");
    address.should.be.equal(mm.address);
  });

  step("should get position ID", async function () {
    let positionId = await mm.generateAtomicPositionId(0);
    console.log("POSITION ID: " + positionId);
  });

  step("should onboard user", async function () {
    await so.onBoard(trader, HUNDRED);
  });

  step("should make a trade", async function () {
    let cost = await mm.calcNetCost([ONE, 0]);
    console.log("Cost of buying outcome A: " + web3.utils.fromWei(cost, 'ether'));
    let balance = await collateral.balanceOf(trader);
    console.log("Balance: " + web3.utils.fromWei(balance, 'ether'));
    await collateral.approve(mm.address, HUNDRED, {from: trader});
    await mm.trade([ONE, 0], 0, {from: trader});
  });
});
