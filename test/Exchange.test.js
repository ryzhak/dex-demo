const Exchange = artifacts.require('Exchange');
const ExchangePool = artifacts.require('ExchangePool');
const ERC20 = artifacts.require('ERC20Testable');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Helper methods
 */
 async function getPoolContract(exchange, tokenAddress1, tokenAddress2) {
    const sortedAddresses = sortStrings(tokenAddress1, tokenAddress2);
    const poolAddress = await exchange.pools(sortedAddresses[0], sortedAddresses[1]);
    return ExchangePool.at(poolAddress);
}

function sortStrings(str1, str2) {
    return str1 < str2 ? [str1, str2] : [str2, str1];
}

contract('Exchange', (accounts) => {
    let exchange = null;
    let catToken = null;
    let dogToken = null;
    const ownerAddress = accounts[0];
    const userAddress = accounts[1];

    beforeEach(async () => {
        // deploy exchange
        exchange = await Exchange.new({from: ownerAddress});
        // deploy CAT and DOG tokens
        catToken = await ERC20.new('CAT TOKEN', 'CAT');
        dogToken = await ERC20.new('DOG TOKEN', 'DOG');
    });

    //================
	// Public methods
	//================

    describe('getPoolAddress()', () => {
        it('should return a pool address', async () => {
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            const sortedAddresses = sortStrings(catToken.address, dogToken.address);
            const poolAddress = await exchange.pools(sortedAddresses[0], sortedAddresses[1]);
            assert.equal(await exchange.getPoolAddress(catToken.address, dogToken.address), poolAddress);
            assert.equal(await exchange.getPoolAddress(dogToken.address, catToken.address), poolAddress);
        });
    });

    describe('sortAddresses()', () => {
        it('should return sorted addresses', async () => {
            const address1 = '0x0000000000000000000000000000000000000001';
            const address2 = '0x0000000000000000000000000000000000000002';
            let result = await exchange.sortAddresses(address1, address2);
            assert.equal(result[0], address1);
            assert.equal(result[1], address2);
            result = await exchange.sortAddresses(address2, address1);
            assert.equal(result[0], address1);
            assert.equal(result[1], address2);
        });
    });

    describe('addLiquidity()', () => {
        it('should should revert if pool does not exist', async () => {
            try {
                await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'POOL_DOES_NOT_EXIST');
            }
        });

        it('should should revert if user does not have enough of the 1st token', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            try {
                await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'NOT_ENOUGH_BALANCE');
            }
        });

        it('should should revert if user does not have enough of the 2nd token', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            // mint 10 CAT tokens to user address
            await catToken.mint(userAddress, web3.utils.toWei('10'), { from: ownerAddress });
            try {
                await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'NOT_ENOUGH_BALANCE');
            }
        });

        it('should mint LP tokens and transfer ERC20 tokens to the pool', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            // get pool contract
            const pool = await getPoolContract(exchange, catToken.address, dogToken.address);
            // mint 10 CAT and 100 DOG tokens to user address
            await catToken.mint(userAddress, web3.utils.toWei('10'), { from: ownerAddress });
            await dogToken.mint(userAddress, web3.utils.toWei('100'), { from: ownerAddress });
            // approve exchange to spend tokens
            await catToken.approve(exchange.address, web3.utils.toWei('10'), { from: userAddress });
            await dogToken.approve(exchange.address, web3.utils.toWei('100'), { from: userAddress });

            // balances before
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('10'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), web3.utils.toWei('100'));
            assert.equal((await pool.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('0'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), web3.utils.toWei('0'));

            // user adds liquidity
            await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });

            // balances after
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await pool.balanceOf(userAddress)).toString(), web3.utils.toWei('10') * web3.utils.toWei('100'));
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('10'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), web3.utils.toWei('100'));
        });
    });

    describe('removeLiquidity()', () => {
        it('should should revert if pool does not exist', async () => {
            try {
                await exchange.removeLiquidity(catToken.address, dogToken.address, web3.utils.toWei('1'), { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'POOL_DOES_NOT_EXIST');
            }
        });

        it('should should revert if user has not enough LP tokens', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            try {
                await exchange.removeLiquidity(catToken.address, dogToken.address, web3.utils.toWei('1'), { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'NOT_ENOUGH_LP_BALANCE');
            }
        });

        it('should burn LP tokens and transfer ERC20 tokens back to the user', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            // get pool contract
            const pool = await getPoolContract(exchange, catToken.address, dogToken.address);
            // mint 10 CAT and 100 DOG tokens to user address
            await catToken.mint(userAddress, web3.utils.toWei('10'), { from: ownerAddress });
            await dogToken.mint(userAddress, web3.utils.toWei('100'), { from: ownerAddress });
            // approve exchange to spend tokens
            await catToken.approve(exchange.address, web3.utils.toWei('10'), { from: userAddress });
            await dogToken.approve(exchange.address, web3.utils.toWei('100'), { from: userAddress });

            // user adds liquidity
            await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });

            // balances before
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await pool.balanceOf(userAddress)).toString(), web3.utils.toWei('10') * web3.utils.toWei('100'));
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('10'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), web3.utils.toWei('100'));

            // user removes liquidity
            const lpTokensAmount = web3.utils.toBN(web3.utils.toWei('10')).mul(web3.utils.toBN(web3.utils.toWei('100'))).toString();
            await exchange.removeLiquidity(catToken.address, dogToken.address, lpTokensAmount, { from: userAddress });

            // balances after
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('10'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), web3.utils.toWei('100'));
            assert.equal((await pool.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('0'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), web3.utils.toWei('0'));
        });
    });

    describe('swap()', () => {
        it('should should revert if pool does not exist', async () => {
            try {
                await exchange.swap(catToken.address, web3.utils.toWei('1'), dogToken.address, { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'POOL_DOES_NOT_EXIST');
            }
        });

        it('should should revert if user does not have enough tokens to sell', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            try {
                await exchange.swap(catToken.address, web3.utils.toWei('1'), dogToken.address, { from: userAddress });
            } catch (err) {
                assert.equal(err.reason, 'NOT_ENOUGH_BALANCE');
            }
        });

        it('should sell ERC20 token', async () => {
            // owner creates CAT/DOG pool
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            // get pool contract
            const pool = await getPoolContract(exchange, catToken.address, dogToken.address);
            // mint 10 CAT and 100 DOG tokens to user address
            await catToken.mint(userAddress, web3.utils.toWei('10'), { from: ownerAddress });
            await dogToken.mint(userAddress, web3.utils.toWei('100'), { from: ownerAddress });
            // approve exchange to spend tokens
            await catToken.approve(exchange.address, web3.utils.toWei('10'), { from: userAddress });
            await dogToken.approve(exchange.address, web3.utils.toWei('100'), { from: userAddress });
            // user adds liquidity
            await exchange.addLiquidity(catToken.address, dogToken.address, web3.utils.toWei('10'), web3.utils.toWei('100'), { from: userAddress });

            // mint 1 CAT token to user address
            await catToken.mint(userAddress, web3.utils.toWei('1'), { from: ownerAddress });
            // approve exchange to transfer 1 CAT token
            await catToken.approve(exchange.address, web3.utils.toWei('1'), { from: userAddress }); 

            // balances before
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('1'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('10'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), web3.utils.toWei('100'));

            // user sells 1 CAT token
            await exchange.swap(catToken.address, web3.utils.toWei('1'), dogToken.address, { from: userAddress });

            // balances after
            assert.equal((await catToken.balanceOf(userAddress)).toString(), web3.utils.toWei('0'));
            assert.equal((await dogToken.balanceOf(userAddress)).toString(), '9090909090909090910');
            assert.equal((await catToken.balanceOf(pool.address)).toString(), web3.utils.toWei('11'));
            assert.equal((await dogToken.balanceOf(pool.address)).toString(), '90909090909090909090');
        });
    });

    //================
	// Owner methods
	//================

    describe('createPool()', () => {
        it('should revert if pool already exists', async () => {
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            try {
                await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            } catch (err) {
                assert.equal(err.reason, 'POOL_EXISTS');
            }
        });

        it('should create a new pool', async () => {
            await exchange.createPool(catToken.address, dogToken.address, { from: ownerAddress });
            const sortedAddresses = sortStrings(catToken.address, dogToken.address);
            const poolAddress = await exchange.pools(sortedAddresses[0], sortedAddresses[1]);
            assert.notEqual(poolAddress, ZERO_ADDRESS);
        });
    });
});
