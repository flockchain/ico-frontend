import {BigNumber, Contract, providers, utils} from "ethers";
import Head from "next/head";
import React, {useEffect, useRef, useState} from "react";
import Web3Modal from "web3modal";
import {
  NFT_CONTRACT_ABI,
  NFT_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ABI,
  TOKEN_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home()
{
  //CReat a BigNumber '0'
  const zero = BigNumber.from(0);
  //WaleltConnected keeps track of wether the users wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  //loading is set to true when we are waiting for a transaction to get mined
  const [loading, setLoading] = useState(false);
  //tokensToBeClaimed keeps track of the number of tokens that can be claimed
  //based on the CryptoDev NFT's held by the user, for which they haven't claimed the tokens
  const [tokensToBeClaimed, setTokensToBeClaimed] = useState(zero);
  //balanceOfCryptoDevTokens keeps track of number of CryptoDevTokens owned by an address
  const [balanceOfCryptoDevsTokens, setBalanceOfCryptoDevsTokens] = useState(zero);
  //amount of the tokens that the user wants to mint
  const [tokenAmount, setTokenAmount] = useState(zero);
  //tokenIsMinted is the total number of tokens that have been minted till now out of 10000(maxSupply)
  const [tokensMinted, setTokensMinted] = useState(zero);
  //isOwner gets the owner of the contract through the signed address
  const [isOwner, setIsOwner] = useState(false);
  //Create a reference to the Web3 Modal (used for conencting to Metamask) which persists as long as the page is open
  const web3Modalref = useRef();

  //getTokensToBeClaimed: checks the balance of tokens that can be claimed by the user
  const getTokensToBeClaimed = async () => 
  {
    try 
    {
      //Get the provider from web3Modal -> Metamask
      //No need for the signer here, as we are only reading from the blockchain
      const provider = await getProviderOrSigner();
      //Create an instance of NFT-Contract
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, provider);
      //Create an instance of tokenContract
      const tokenContract = new  Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //We will get the signer now to extract the address of the currently connected Metamask account
      const signer = await getProviderOrSigner(true);
      //Get the address associated to the signer which is connected to Metamask 
      const address = await signer.getAddress();
      //Call the balnceOf() function from the NFT-Contract to get the number of NFT's held by the user
      const balance = await nftContract.balanceOf(address);
      //balance is a big number and thus we have to compare it with BigNumber 'zero'
      if(balance == zero)
      {
        setTokensToBeClaimed(zero);
      }
      else
      {
        //amount keeps track of the number of unclaimed tokens
        var amount = 0;
        //Check for all owned NFT's of this address
        //Only increase amount if tokens wasn't claimed for this NFT
        for(var i = 0; i < balance; i++)
        {
          const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
          const claimed = await tokenContract.tokenIdsClaimed(tokenId);
          if(!claimed)
          {
            amount++;
          }
        }
        //tokensToBeClaimed is a BigNumber, so we need to do a conversion
        setTokensToBeClaimed(BigNumber.from(amount));
      }
    }catch(err)
    {
      console.error(err);
      setTokensToBeClaimed(zero);
    }
  };

  const getBalanceOfCryptoDevsTokens = async () => 
  {
    try
    {
      //Get Metamask-provider from web3Modal reference 
      //Only the provider is needed, because we are only going to read from the blockchain
      const provider = await getProviderOrSigner();
      //create an instance of token contract
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //Now get get the signer of the currently connected Metamask-account
      const signer = await getProviderOrSigner(true);
      //Get the addres associated to the signer
      const address = await signer.getAddress();
      //Call the balanceOf() function to get the amount of tokens held by the user
      const balance = await tokenContract.balanceOf(address);
      //balance is already a BigNumber, no need for convention
      setBalanceOfCryptoDevsTokens(balance);
    }catch(err)
    {
      console.error(err);
      setBalanceOfCryptoDevsTokens(zero);
    }
  };

  //Mints 'amount' number of tokens to a given address
  const mintCryptoDevToken = async (amount) => 
  {
    try
    {
      //We need a signer here since we are writing a transaction to the blockchain
      const signer = getProviderOrSigner(true);
      //Create an instance of the token contract
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
      //Each token is of '0.001 ether' The Value we need to send is '0.001 * amount'
      const value = 0.001 * amount;
      const tx = await tokenContract.mint(amount, {value: utils.parseEther(value.toString()),});
      setLoading(true);
      //wait for hte transaction to get mined
      await tx.wait();
      setLoading(false);
      window.alert("Sucessfully minted CryptoDev Tokens");
      await getBalanceOfCryptoDevsTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    }catch(err)
    {
      console.error(err);
    }
  };

  //Helps the user claim CryptoDev Tokens
  const claimCryptoDevTokens = async () => 
  {
    try
    {
      //We need a signer here since its a 'write' transaction
      const signer = await getProviderOrSigner(true);
      //Create an instance of the tokenContract
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
      const tx = await tokenContract.claim();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      window.alert("Sucessfully claimed CryptDev Token");
      await getBalanceOfCryptoDevsTokens();
      await getTotalTokensMinted();
      await getTokensToBeClaimed();
    }catch(err)
    {
      console.error(err);
    }
  };

  //Get how many CryptoDev Tokens hav been minted now
  const getTotalTokensMinted = async () => 
  {
    try
    {
      //We only need the provider since its a read transaction
      const provider = getProviderOrSigner();
      //Create an instance of the Contract with the provider 
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //Get amount of tokens that have been minted already 
      const _tokensMinted = await tokenContract.totalSupply();
      setTokensMinted(_tokensMinted);
    }catch(err)
    {
      console.error(err);
    }
  };

  const getOwner = async () =>
  {
    try
    {
      const provider = await getProviderOrSigner();
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);
      //call the owner() function from the contract
      const _owner = await tokenContract.owner();
      //Get the signer to extract address of the currently connected Metamask account 
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      if(address.toLowerCase() === _owner.toLowerCase())
      {
        setIsOwner(true);
      } 
    }catch(err)
    {
      console.error(err);
    }
  }; 

  //withdraw your well deserved money ;)
  const withdrawCoins = async () => 
  {
    try
    {
      const signer = await getProviderOrSigner(true);
      const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
      const tx = await tokenContract.withdraw();
      setLoading(true);
      await tx.wait(),
      setLoading(false);
      await getOwner();
    }catch(err)
    {
      console.error(err);
    }
  };

  const getProviderOrSigner = async (needSigner = false) =>
  {
    //Because web3Modal is stored as a reference we have to call current to access a real object of it
    const provider = await web3Modalref.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    //If user is not connected to goerli network, let them know and throw an error
    const {chainId} = await web3Provider.getNetwork();
    if(chainId !== 5)
    {
      window.alert("Change the network to Goerli");
      throw new Error("Change network to Goerli");
    }

    if(needSigner)
    {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  const connectWallet = async () => 
  {
    try
    {
      await getProviderOrSigner();
      setWalletConnected(true);
    }catch(err)
    {
      console.error(err);
    }
  };

  //useEffects are used to react to changes in the states of the website
  //The array at the end of function call represents what state changes will trigger this effect
  //In this case, whenever the value of 'walletConnected' changes - this effect will be called
  useEffect(() => {
    //If wallet is not connected, create a new instance of web3Modal and connect the Metamaks wallet
    if(!walletConnected)
    {
      web3Modalref.current = new Web3Modal({network: "goerli", providerOptions: {}, disableInjectedProvider: false,});
      connectWallet();
      getTotalTokensMinted();
      getBalanceOfCryptoDevsTokens();
      getTokensToBeClaimed();
      withdrawCoins();
    }
  }, [walletConnected]);

  const renderButton = () => 
  {
    if(loading)
    {
      return(
        <div>
          <button className={styles.button}>Loading...</button>
        </div>
      );
    }
    if(walletConnected && isOwner)
    {
      return(
        <div>
          <button className={styles.button} onClick={withdrawCoins}>Withdraw Coins</button>
        </div>
      );
    }
    if(tokensToBeClaimed > 0)
    {
      return(
        <div>
          <div className={styles.description}>
            {tokensToBeClaimed * 10} Tokens can be claimed!
          </div>
          <button className={styles.button} onClick={claimCryptoDevTokens}>Claim Tokens</button>
        </div>
      );
    }
    return(
      <div style={{display: "flex-col"}}>
        <div>
          <input type="number" placeholder="Amount of Tokens"
          onChange={(e) => setTokenAmount(BigNumber.from(e.target.value))}
          className={styles.input}/>
        </div>
        <button className={styles.button} disabled={!(tokenAmount > 0)} onClick={() => mintCryptoDevToken(tokenAmount)}>Mint Tokens</button>
      </div>
    );
  };

  return(
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="ICO-Dapp"/>
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to CryptoDevs ICO!</h1>
          <div className={styles.description}>
            You can claim or mint CryptoDev Tokens here
          </div>
          {walletConnected ? (
            <div>
              <div className={styles.description}>
                Yout have minted {utils.formatEther(balanceOfCryptoDevsTokens)} CryptoDev Tokens
              </div>
              <div className={styles.description}>
                Overall {utils.formatEther(tokensMinted)}/10000 have been minted!!!
              </div>
              {renderButton()}
            </div>
          ) : (
            <button onClick={connectWallet} className={styles.button}>
              Connect your Wallet
            </button>
          )}
        </div>
        <div>
          <img className={styles.image} src="./0.svg"/>
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; by CryptoDevs
      </footer>
    </div>
  )
}