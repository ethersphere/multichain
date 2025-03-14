// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/*
    ██████╗  █████╗ ████████╗ ██████╗██╗  ██╗
    ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║  ██║
    ██████╔╝███████║   ██║   ██║     ███████║
    ██╔══██╗██╔══██║   ██║   ██║     ██╔══██║
    ██████╔╝██║  ██║   ██║   ╚██████╗██║  ██║
    ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
                                              
    ██████╗ ███████╗ ██████╗ ██╗███████╗████████╗██████╗ ██╗   ██╗
    ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝
    ██████╔╝█████╗  ██║  ███╗██║███████╗   ██║   ██████╔╝ ╚████╔╝ 
    ██╔══██╗██╔══╝  ██║   ██║██║╚════██║   ██║   ██╔══██╗  ╚██╔╝  
    ██║  ██║███████╗╚██████╔╝██║███████║   ██║   ██║  ██║   ██║   
    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   
*/

interface ISwarmContract {
    function createBatch(
        address _owner,
        uint256 _initialBalancePerChunk,
        uint8 _depth,
        uint8 _bucketDepth,
        bytes32 _nonce,
        bool _immutable
    ) external;

    function currentTotalOutPayment() external view returns (uint256);
}

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
}

contract StampRegistry {
    // State variables
    ISwarmContract public swarmStampContract;
    IERC20 public constant BZZ_TOKEN =
        IERC20(0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da);
    mapping(bytes32 => address) public batchPayers;
    address public admin;

    // Events
    event BatchCreated(
        bytes32 indexed batchId,
        uint256 totalAmount,
        uint256 normalisedBalance,
        address indexed owner,
        address indexed payer,
        uint8 depth,
        uint8 bucketDepth,
        bool immutable_
    );
    event SwarmContractUpdated(address oldAddress, address newAddress);

    // Custom errors
    error TransferFailed();
    error ApprovalFailed();

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    constructor(address _swarmContractAddress) {
        swarmStampContract = ISwarmContract(_swarmContractAddress);
        admin = msg.sender;
    }

    /**
     * @notice Updates the swarm contract address
     * @param _newSwarmContractAddress New address of the swarm contract
     */
    function updateSwarmContract(
        address _newSwarmContractAddress
    ) external onlyAdmin {
        address oldAddress = address(swarmStampContract);
        swarmStampContract = ISwarmContract(_newSwarmContractAddress);
        emit SwarmContractUpdated(oldAddress, _newSwarmContractAddress);
    }

    /**
     * @notice Creates a new batch and registers the payer
     * @param _owner Address that pays for the batch, but not the owner of the batch
     * @param _nodeAddress Address of the node that will own the batch
     * @param _initialBalancePerChunk Initial balance per chunk
     * @param _depth Depth of the batch
     * @param _bucketDepth Bucket depth
     * @param _nonce Unique nonce for the batch
     * @param _immutable Whether the batch is immutable
     */
    function createBatchRegistry(
        address _owner,
        address _nodeAddress,
        uint256 _initialBalancePerChunk,
        uint8 _depth,
        uint8 _bucketDepth,
        bytes32 _nonce,
        bool _immutable
    ) external {
        // Calculate total amount
        uint256 totalAmount = _initialBalancePerChunk * (1 << _depth);

        // Transfer BZZ tokens from sender to this contract
        if (!BZZ_TOKEN.transferFrom(msg.sender, address(this), totalAmount)) {
            revert TransferFailed();
        }

        // Approve swarmStampContract to spend the BZZ tokens
        if (!BZZ_TOKEN.approve(address(swarmStampContract), totalAmount)) {
            revert ApprovalFailed();
        }

        // Call the original swarm contract with nodeAddress as owner
        swarmStampContract.createBatch(
            _nodeAddress,
            _initialBalancePerChunk,
            _depth,
            _bucketDepth,
            _nonce,
            _immutable
        );

        // Calculate batchId as bytes32
        bytes32 batchId = keccak256(abi.encode(address(this), _nonce));

        // Store the payer information
        batchPayers[batchId] = _owner;

        // Get normalized balance
        uint256 normalisedBalance = swarmStampContract
            .currentTotalOutPayment() + _initialBalancePerChunk;

        // Emit the batch creation event
        emit BatchCreated(
            batchId,
            totalAmount,
            normalisedBalance,
            _nodeAddress,
            _owner,
            _depth,
            _bucketDepth,
            _immutable
        );
    }

    /**
     * @notice Get the payer address for a specific batch ID
     * @param _batchId The ID of the batch
     * @return The address of the payer
     */
    function getBatchPayer(bytes32 _batchId) external view returns (address) {
        return batchPayers[_batchId];
    }
}
