export class WalletError extends Error {
    public readonly code: string;
    public readonly originalError?: Error;
  
    constructor(message: string, code: string, originalError?: Error) {
      super(message);
      this.name = this.constructor.name;
      this.code = code;
      this.originalError = originalError;
      
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  }
  
  export class ConfigurationError extends WalletError {
    constructor(message: string, code: string = 'CONFIG_ERROR') {
      super(message, code);
    }
  }
  
  export class AccountError extends WalletError {
    constructor(message: string, code: string = 'ACCOUNT_ERROR') {
      super(message, code);
    }
  }
  
  export class TransactionError extends WalletError {
    constructor(message: string, code: string = 'TX_ERROR') {
      super(message, code);
    }
  }
  
  export class NetworkError extends WalletError {
    constructor(message: string, code: string = 'NETWORK_ERROR', originalError?: Error) {
      super(message, code, originalError);
    }
  }
  
  export class ValidationError extends WalletError {
    constructor(message: string, code: string = 'VALIDATION_ERROR') {
      super(message, code);
    }
  }
  
  export class WebSocketError extends WalletError {
    constructor(message: string, code: string = 'WS_ERROR') {
      super(message, code);
    }
  }
  
  export class CryptographicError extends WalletError {
    constructor(message: string, code: string = 'CRYPTO_ERROR') {
      super(message, code);
    }
  }
  
  // Specific error subtypes
  export class InvalidSeedError extends ConfigurationError {
    constructor() {
      super('Invalid seed format - must be 64-character hex string', 'INVALID_SEED');
    }
  }
  
  export class MissingConfigurationError extends ConfigurationError {
    constructor(missingField: string) {
      super(`Missing required configuration: ${missingField}`, 'MISSING_CONFIG');
    }
  }
  
  export class AccountNotFoundError extends AccountError {
    constructor(address: string) {
      super(`Account not found: ${address}`, 'ACCOUNT_NOT_FOUND');
    }
  }
  
  export class InvalidAddressError extends ValidationError {
    constructor(address: string) {
      super(`Invalid address format: ${address}`, 'INVALID_ADDRESS');
    }
  }
  
  export class InvalidAmountError extends ValidationError {
    constructor(amount: string) {
      super(`Invalid amount format: ${amount}`, 'INVALID_AMOUNT');
    }
  }
  
  export class TransactionFailedError extends TransactionError {
    constructor(details: string) {
      super(`Transaction failed: ${details}`, 'TX_FAILED');
    }
  }
  
  export class WebSocketMessageError extends WebSocketError {
    constructor() {
      super('Invalid WebSocket message format', 'WS_INVALID_MESSAGE');
    }
  }
  
  export class WorkGenerationError extends NetworkError {
    constructor(details: string) {
      super(`Work generation failed: ${details}`, 'WORK_GENERATION_FAILED');
    }
  }