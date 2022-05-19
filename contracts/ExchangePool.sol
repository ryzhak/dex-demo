// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @title DEX pool contract
 */
contract ExchangePool is ERC20, Ownable {
	// ERC20 token addresses in the pool (sorted: tokenAddress0 < tokenAddress1)
	address public tokenAddress0;
	address public tokenAddress1;

	/**
	 * @notice Contract constructor
	 * @param _tokenAddress0 1st ERC20 token address in the pool
	 * @param _tokenAddress1 2nd ERC20 token address in the pool
	 */
  	constructor(address _tokenAddress0, address _tokenAddress1) ERC20('POOL-TOKEN', 'POOL-LP') {
		  tokenAddress0 = _tokenAddress0;
		  tokenAddress1 = _tokenAddress1;
  	}

	//======================
	// Owner methods.
	// Owner is an exchange.
	//======================

	/**
	 * @notice Approves owner (normally the exchange contract) to spend tokens in the pool
	 * @param _tokenAddress ERC20 token address in the pool
	 * @param _tokenAmount ERC20 token amount to approve
	 */
	function approvePoolTokenAmount(
        address _tokenAddress,
        uint256 _tokenAmount
    ) public onlyOwner {
        require(tokenAddress0 == _tokenAddress || tokenAddress1 == _tokenAddress, 'NOT_POOL_TOKEN');
        ERC20(_tokenAddress).approve(owner(), _tokenAmount);
    }

	/**
	 * @notice Burns LP tokens
	 * @param _account account address to burn LP tokens from
	 * @param _amount amount of tokens to burn
	 */
	function burn(address _account, uint256 _amount) public onlyOwner {
        _burn(_account, _amount);
    }

	/**
	 * @notice Mints LP tokens
	 * @param _account address where to mint LP tokens
	 * @param _amount amount of LP tokens to mint
	 */
	function mint(address _account, uint256 _amount) public onlyOwner {
        _mint(_account, _amount);
    }
}
