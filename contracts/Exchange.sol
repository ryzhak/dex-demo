// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './ExchangePool.sol';

/**
 * @title demo DEX contract
 */
contract Exchange is Ownable {
	// all available liquidity pools for token pairs
	mapping(address => mapping(address => address)) public pools;

	//================
	// Public methods
	//================

	/**
	 * @notice Returns a pool address by ERC20 token addresses in the pool (addresses can be in any order)
	 * @param _tokenAddress0 1st ERC20 token address in the pool
	 * @param _tokenAddress1 2nd ERC20 token address in the pool
	 */
	function getPoolAddress(address _tokenAddress0, address _tokenAddress1) public view returns (address) {
		// sort addresses and return a pool address
		(address sortedTokenAddress0, address sortedTokenAddress1) = sortAddresses(_tokenAddress0, _tokenAddress1);
		return pools[sortedTokenAddress0][sortedTokenAddress1];
	}

	/**
	 * @notice Sorts 2 addresses (addresses in the pool are always sorted)
	 * @param _tokenAddress0 1st ERC20 token address in the pool
	 * @param _tokenAddress1 2nd ERC20 token address in the pool
	 */
	function sortAddresses(address _tokenAddress0, address _tokenAddress1) public pure returns (address, address) {
		return _tokenAddress0 < _tokenAddress1 ? (_tokenAddress0, _tokenAddress1) : (_tokenAddress1, _tokenAddress0);
	}

	/**
	 * @notice Adds liquidity (ERC20 tokens) to the pool
	 * @param _tokenAddress0 1st ERC20 token address
	 * @param _tokenAddress1 2nd ERC20 token address
	 * @param _amountToken0 1st ERC20 token amount
	 * @param _amountToken1 2nd ERC20 token amount
	 */
	function addLiquidity(
		address _tokenAddress0,
		address _tokenAddress1,
		uint256 _amountToken0,
		uint256 _amountToken1
	) external {
		// get a pool contract
		ExchangePool pool = ExchangePool(getPoolAddress(_tokenAddress0, _tokenAddress1));
		// check that pool exists
		require(address(pool) != address(0), 'POOL_DOES_NOT_EXIST');
		// check that user has enough tokens
		require(IERC20(_tokenAddress0).balanceOf(msg.sender) >= _amountToken0, 'NOT_ENOUGH_BALANCE');
		require(IERC20(_tokenAddress1).balanceOf(msg.sender) >= _amountToken1, 'NOT_ENOUGH_BALANCE');

		// transfer tokens to the pool (user should approve exchange contract to transfer tokens)
		IERC20(_tokenAddress0).transferFrom(msg.sender, address(pool), _amountToken0);
		IERC20(_tokenAddress1).transferFrom(msg.sender, address(pool), _amountToken1);

		// mint LP tokens to the user
		pool.mint(msg.sender, _amountToken0 * _amountToken1);
	}

	/**
	 * @notice Removes liquidity from the pool.
	 * Burns user's LP tokens and transfers his ERC20 tokens back.
	 * @param _tokenAddress0 1st ERC20 token address in the pool
	 * @param _tokenAddress1 2nd ERC20 token address in the pool
	 * @param _lpTokensAmount amount of LP (liquidity provider) tokens to burn
	 */
	function removeLiquidity(
		address _tokenAddress0,
		address _tokenAddress1,
		uint256 _lpTokensAmount
	) external {
		// get a pool contract
		ExchangePool pool = ExchangePool(getPoolAddress(_tokenAddress0, _tokenAddress1));
		// check that pool exists
		require(address(pool) != address(0), 'POOL_DOES_NOT_EXIST');
		// check that user has enough LP tokens
		require(IERC20(address(pool)).balanceOf(msg.sender) >= _lpTokensAmount, 'NOT_ENOUGH_LP_BALANCE');

		// burn LP tokens
		pool.burn(msg.sender, _lpTokensAmount);

		// get token amounts to transfer
		uint256 totalShares = (IERC20(pool.tokenAddress0()).balanceOf(address(pool)) * IERC20(pool.tokenAddress1()).balanceOf(address(pool)));
		uint256 tokenAmount0 = _lpTokensAmount * IERC20(pool.tokenAddress0()).balanceOf(address(pool)) / totalShares;
		uint256 tokenAmount1 = _lpTokensAmount * IERC20(pool.tokenAddress1()).balanceOf(address(pool)) / totalShares;

		// approve exchange to transfer tokens from the pool address
		pool.approvePoolTokenAmount(pool.tokenAddress0(), tokenAmount0);
		pool.approvePoolTokenAmount(pool.tokenAddress1(), tokenAmount1);

		// transfer tokens to the user
		IERC20(pool.tokenAddress0()).transferFrom(address(pool), msg.sender, tokenAmount0);
		IERC20(pool.tokenAddress1()).transferFrom(address(pool), msg.sender, tokenAmount1);
	}

	/**
	 * @notice Sells a given amount of input token for output token
	 * @param _tokenAddressIn address of the ERC20 token that user wants to sell
	 * @param _tokenAmountIn amoint of ERC20 token that user wants to sell
	 * @param _tokenAddressOut address of the output ERC20 token which user wants to buy
	 */
	function swap(
		address _tokenAddressIn,
		uint256 _tokenAmountIn,
		address _tokenAddressOut
	) external {
		// get a pool contract
		ExchangePool pool = ExchangePool(getPoolAddress(_tokenAddressIn, _tokenAddressOut));
		// check that pool exists
		require(address(pool) != address(0), 'POOL_DOES_NOT_EXIST');
		// check that user has enough tokens to sell
		require(IERC20(_tokenAddressIn).balanceOf(msg.sender) >= _tokenAmountIn, 'NOT_ENOUGH_BALANCE');

		// calculate the amount of out token that user should get for selling input token
		uint k = IERC20(pool.tokenAddress0()).balanceOf(address(pool)) * IERC20(pool.tokenAddress1()).balanceOf(address(pool));
		uint256 tokenAmountInAfter = _tokenAmountIn + IERC20(_tokenAddressIn).balanceOf(address(pool));
		uint256 tokenAmountOutAfter = k / tokenAmountInAfter;
		uint256 tokenAmountOut = IERC20(_tokenAddressOut).balanceOf(address(pool)) - tokenAmountOutAfter;

		// ensure that pool is not competely emptied
		if (tokenAmountOut == IERC20(_tokenAddressOut).balanceOf(address(pool))) tokenAmountOut--;

		// approve exchange to transfer pool tokens
		pool.approvePoolTokenAmount(_tokenAddressOut, tokenAmountOut);

		// make a swap
		ERC20(_tokenAddressIn).transferFrom(msg.sender, address(pool), _tokenAmountIn);
		ERC20(_tokenAddressOut).transferFrom(address(pool), msg.sender, tokenAmountOut);
	}

  	//================
	// Owner methods
	//================

	/**
	 * @notice Creates a new pool
	 * @param _tokenAddress0 1st ERC20 token address in the pool
	 * @param _tokenAddress1 2nd ERC20 token address in the pool
	 */
	function createPool(address _tokenAddress0, address _tokenAddress1) external onlyOwner {
		// sort addresses
		(address sortedTokenAddress0, address sortedTokenAddress1) = sortAddresses(_tokenAddress0, _tokenAddress1);
		// check that pool does not exist
		require(pools[sortedTokenAddress0][sortedTokenAddress1] == address(0), 'POOL_EXISTS');
		// create a pool
		ExchangePool pool = new ExchangePool(sortedTokenAddress0, sortedTokenAddress1);
		pools[sortedTokenAddress0][sortedTokenAddress1] = address(pool);
	}
}
