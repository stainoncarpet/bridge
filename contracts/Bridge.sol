//SPDX-License-Identifier: MIT

pragma solidity >=0.8.11 <0.9.0;

//import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

interface IBridge {
    //function swap() external;
    // function redeem() external;
    // function updateChainById() external;
    // function includeToken() external;
    // function excludeToken() external;

    event swapInitialized(address, address, uint256, uint256, uint256, uint256, string);

    event swapFinalized(address, address, uint256, uint256, uint256, uint256, string);
    event chainUpdated(uint256, bool);
    event tokenIncluded(address, address, string);
    event tokenExcluded(string);
}

contract Bridge is IBridge, Ownable {
    address Validator;

    mapping(bytes32 => bool) hasBeenSwapped;
    //mapping(address => string) availableTokens;
    mapping(string => address[2]) availableTokens;
    mapping(uint256 => bool) availableChains;
     
    constructor(address _validator) {
        Validator = _validator;
    }

    //- Функция swap(): списывает токены с пользователя и испускает event ‘swapInitialized’
    // function swap(address recipient, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol) external {
    //     bytes32 swapHash = keccak256(abi.encodePacked(recipient, amount, chainfrom, chainto, nonce, symbol));
        
    //     if(hasBeenSwapped[swapHash] == false) {
    //         Token.call{value:0}(abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount));
    //         hasBeenSwapped[swapHash] = true;
    //         emit swapInitialized(recipient, amount, chainfrom, chainto, nonce, symbol);
    //     } else {
    //         revert("Swap already registered");
    //     }
    // }

    function swap(address sourceToken, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol) external {
        require((availableTokens[symbol][0] != address(0)) && (availableTokens[symbol][1] != address(0)), "Token is not available");
        require(availableChains[chainfrom] && availableChains[chainto], "Chain is not available");

        // bytes32 swapHash = keccak256(abi.encodePacked(msg.sender, amount, chainfrom, chainto, nonce, symbol));
        bytes32 swapHash = getSwapHash(msg.sender, sourceToken, amount, chainfrom, chainto, nonce, symbol);

        require(hasBeenSwapped[swapHash] != true, "Swap already registered");
        
        sourceToken.call{value:0}(abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount));
        hasBeenSwapped[swapHash] = true;

        emit swapInitialized(msg.sender, sourceToken, amount, chainfrom, chainto, nonce, symbol);
    }

    //- Функция redeem(): вызывает функцию ecrecover и восстанавливает по хэшированному сообщению и сигнатуре адрес валидатора, 
    // если адрес совпадает с адресом указанным на контракте моста то пользователю отправляются токены
    // function redeem(address recipient, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol, bytes calldata signature) external {
    //     require(recipient == msg.sender, "Only recipient can redeem");

    //     bytes32 swapHash = keccak256(abi.encodePacked(recipient, amount, chainfrom, chainto, nonce, symbol));
    //     address validator = recoverSigner(prefixed(swapHash), signature);

    //     if(validator == Validator && hasBeenSwapped[swapHash] == false) {
    //         Token.call{value:0}(abi.encodeWithSignature("mint(address,uint256)", recipient, amount));
    //         hasBeenSwapped[swapHash] = true;
    //         emit swapFinalized(recipient, amount, chainfrom, chainto, nonce, symbol);
    //     } else {
    //         revert("Swap already registered or data is corrupt");
    //     }
    // }

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
    
    //- Функция updateChainById(): добавить блокчейн или удалить по его chainID
    function updateChainById(uint256 chainId) external onlyOwner {
        if(availableChains[chainId]) {
            availableChains[chainId] = false;
            emit chainUpdated(chainId, false);
        } else {
            availableChains[chainId] = true;
            emit chainUpdated(chainId, true);
        }
    }

   // - Функция includeToken(address addr, string memory symb): добавить токен для передачи его в другую сеть
   // token symbol + tokens addresses in both networks
    function includeToken(address addr1, address addr2, string memory symbol) external onlyOwner {
        availableTokens[symbol][0] = addr1;
        availableTokens[symbol][1] = addr2;
        emit tokenIncluded(addr1, addr2, symbol);
    }

    //- Функция excludeToken(): исключить токен для передачи
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