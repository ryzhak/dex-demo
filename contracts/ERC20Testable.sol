// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @title DEX pool contract
 */
contract ERC20Testable is ERC20, Ownable {
    
  	constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

	/**
	 * @notice Mints tokens
	 * @param _account address where to mint tokens
	 * @param _amount amount of tokens to mint
	 */
	function mint(address _account, uint256 _amount) public onlyOwner {
        _mint(_account, _amount);
    }
}
