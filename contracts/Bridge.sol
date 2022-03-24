//SPDX-License-Identifier: MIT

pragma solidity >=0.8.11 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBridge {
    event swapInitialized(address, address, uint256, uint256, uint256, uint256, string);
    event swapFinalized(address, address, uint256, uint256, uint256, uint256, string);
    event chainUpdated(uint256, bool);
    event tokenIncluded(address, address, string);
    event tokenExcluded(string);
}

contract Bridge is IBridge, Ownable {
    address Validator;
    mapping(bytes32 => bool) hasBeenSwapped;
    mapping(string => address[2]) availableTokens;
    mapping(uint256 => bool) availableChains;
     
    constructor() {}

    function setValidator(address _validator) external onlyOwner {
        Validator = _validator;
    }

    function swap(address sourceToken, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol) external {
        require((availableTokens[symbol][0] != address(0)) && (availableTokens[symbol][1] != address(0)), "Token is not available");
        require(availableChains[chainfrom] && availableChains[chainto], "Chain is not available");

        bytes32 swapHash = getSwapHash(msg.sender, sourceToken, amount, chainfrom, chainto, nonce, symbol);

        require(hasBeenSwapped[swapHash] != true, "Swap already registered");
        
        sourceToken.call{value:0}(abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount));
        hasBeenSwapped[swapHash] = true;

        emit swapInitialized(msg.sender, sourceToken, amount, chainfrom, chainto, nonce, symbol);
    }

    function redeem(address sourceToken, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol, bytes calldata signature) external {
        bytes32 swapHash = getSwapHash(msg.sender, sourceToken, amount, chainfrom, chainto, nonce, symbol);
        address validator = recoverSigner(prefixed(swapHash), signature);

        if(validator == Validator && hasBeenSwapped[swapHash] == false) {
            address targetToken = availableTokens[symbol][0] == sourceToken ? availableTokens[symbol][1] : availableTokens[symbol][0];
            targetToken.call{value:0}(abi.encodeWithSignature("mint(address,uint256)", msg.sender, amount));
            hasBeenSwapped[swapHash] = true;
            emit swapFinalized(msg.sender, targetToken, amount, chainfrom, chainto, nonce, symbol);
        } else {
            revert("Swap already registered or data is corrupt");
        }
    }
    
    function updateChainById(uint256 chainId) external onlyOwner {
        if(availableChains[chainId]) {
            availableChains[chainId] = false;
            emit chainUpdated(chainId, false);
        } else {
            availableChains[chainId] = true;
            emit chainUpdated(chainId, true);
        }
    }

    function includeToken(address addr1, address addr2, string memory symbol) external onlyOwner {
        availableTokens[symbol][0] = addr1;
        availableTokens[symbol][1] = addr2;
        emit tokenIncluded(addr1, addr2, symbol);
    }

    function excludeToken(string memory symbol) external onlyOwner {
        delete availableTokens[symbol];
        emit tokenExcluded(symbol);
    }


    function splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s){
       require(sig.length == 65);
       assembly {
           r := mload(add(sig, 32))
           s := mload(add(sig, 64))
           v := byte(0, mload(add(sig, 96)))
       }
       return (v, r, s);
   }

   function recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
       (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
       return ecrecover(message, v, r, s);
   }
 
   function prefixed(bytes32 hash) internal pure returns (bytes32) {
       return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
   }

   function getSwapHash(address sender, address token, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol) internal pure returns (bytes32) {
       return keccak256(abi.encodePacked(
           sender,
           token,
           amount, 
           chainfrom, 
           chainto, 
           nonce, 
           symbol
        ));
   }
}