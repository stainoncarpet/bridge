//SPDX-License-Identifier: MIT

pragma solidity >=0.8.11 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    address bridge;

    constructor(uint256 initialSupply, string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    modifier onlyBridge() {
        require(msg.sender == bridge, "Only bridge can perform this action");
        _;
    }

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function mint(address account, uint256 amount) external onlyBridge {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyBridge {
        _burn(account, amount);
    }
}
