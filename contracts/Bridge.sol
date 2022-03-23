//SPDX-License-Identifier: MIT

pragma solidity >=0.8.11 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

interface IBridge {
    //function swap() external;
    // function redeem() external;
    // function updateChainById() external;
    // function includeToken() external;
    // function excludeToken() external;

    event swapInitialized(address, uint256, uint256, uint256, uint256, string);
    event swapCompleted(address, uint256, uint256, uint256, uint256, string);
}

contract Bridge is IBridge, Ownable {
    address Token;
    address Validator;
    mapping(bytes32 => bool) hasBeenSwapped;
     
    constructor(address _token, address _validator) {
        Token = _token;
        Validator = _validator;
    }

    //- Функция swap(): списывает токены с пользователя и испускает event ‘swapInitialized’
    function swap(address recipient, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol) external {
        Token.call{value:0}(abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount));
        emit swapInitialized(recipient, amount, chainfrom, chainto, nonce, symbol);
    }

    //- Функция redeem(): вызывает функцию ecrecover и восстанавливает по хэшированному сообщению и сигнатуре адрес валидатора, 
    // если адрес совпадает с адресом указанным на контракте моста то пользователю отправляются токены
    function redeem(address recipient, uint256 amount, uint256 chainfrom, uint256 chainto, uint256 nonce, string memory symbol, bytes calldata signature) external {
        bytes32 swapHash = keccak256(abi.encodePacked(recipient, amount, chainfrom, chainto, nonce, symbol));
        address validator = recoverSigner(prefixed(swapHash), signature);

        if(validator == Validator && hasBeenSwapped[swapHash] == false) {
            Token.call{value:0}(abi.encodeWithSignature("mint(address,uint256)", recipient, amount));
            hasBeenSwapped[swapHash] = true;
            emit swapCompleted(recipient, amount, chainfrom, chainto, nonce, symbol);
        }
    }
    
    //- Функция updateChainById(): добавить блокчейн или удалить по его chainID
    // function updateChainById() external {

    // }

   // - Функция includeToken(): добавить токен для передачи его в другую сеть
    // function includeToken() {

    // }

    //- Функция excludeToken(): исключить токен для передачи
    // function excludeToken() external {

    // }


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
}
