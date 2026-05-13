import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, View, StyleSheet, ActivityIndicator, Button, ScrollView 
} from 'react-native';
import {
  Network,
  Mnemonic,
  DescriptorSecretKey,
  Descriptor,
  Wallet,
  Persister,
  KeychainKind,
  ElectrumClient,
  type AddressInfo,
} from 'bdk-rn';

export default function App() {
  const [address, setAddress] = useState<string>('');
  const [mnemonicText, setMnemonicText] = useState<string>('');
  const [balance, setBalance] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<string>('Initializing...');
  
  const walletRef = useRef<any>(null);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        setLog("Generating Wallet...");
        
        // Hardcoded for demo purposes
        const recoveryPhrase = "awesome awesome awesome awesome awesome awesome awesome awesome awesome awesome awesome awesome";
        const mnemonic = await Mnemonic.fromString(recoveryPhrase);
        setMnemonicText(recoveryPhrase);

        const secretKey = await new DescriptorSecretKey(Network.Signet, mnemonic, undefined);
        const descriptor = await Descriptor.newBip86(secretKey, KeychainKind.External, Network.Signet);
        const persister = await Persister.newInMemory();
        
        const wallet = await Wallet.createSingle(descriptor, Network.Signet, persister);
        walletRef.current = wallet;

        const addressInfo: AddressInfo = await wallet.revealNextAddress(KeychainKind.External);
        setAddress(addressInfo.address.toString());
        
        setLog("Wallet Ready. Click Sync to fetch data.");

      } catch (err) {
        setLog(`Error: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, []);

  const syncWallet = async () => {
    if (!walletRef.current) return;
    
    setSyncing(true);
    setLog("Connecting to Electrum...");

    try {
      // PROD CONFIG: Using secure SSL to a stable Signet Node
      const client = new ElectrumClient('ssl://mempool.space:60602');

      setLog("Building Request...");
      const fullScanRequest = walletRef.current.startFullScan().build();

      setLog("Downloading headers...");
      const update = client.fullScan(fullScanRequest, BigInt(20), BigInt(20), false);

      setLog("Applying to Wallet...");
      walletRef.current.applyUpdate(update);

      const balanceInfo = walletRef.current.balance();
      setBalance(balanceInfo);
      
      setLog("Sync Complete!");
    } catch (err) {
      setLog(`Sync Error: ${err}`);
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Setting up Wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>BDK React Native</Text>

        <Text style={styles.logText}>{log}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Network:</Text>
          <Text style={styles.value}>Signet</Text>
          
          <Text style={styles.label}>Address:</Text>
          <Text style={styles.address}>{address}</Text>

          <Text style={styles.label}>Mnemonic:</Text>
          <Text style={styles.mnemonic} numberOfLines={1} ellipsizeMode='middle'>
            {mnemonicText}
          </Text>
        </View>

        <View style={[styles.card, styles.balanceCard]}>
          <Text style={styles.label}>Confirmed Balance:</Text>
          <Text style={styles.bigBalance}>
            {balance ? balance.confirmed.toSat().toString() : 0} <Text style={styles.sats}>sats</Text>
          </Text>

          <Text style={styles.label}>Unconfirmed / Pending:</Text>
          <Text style={styles.smallBalance}>
            {balance ? (balance.trustedPending.toSat() + balance.untrustedPending.toSat()).toString() : 0} sats
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button 
            title={syncing ? "Syncing..." : "Sync Wallet"}
            onPress={syncWallet}
            disabled={syncing}
          />
          {syncing && <ActivityIndicator style={{marginLeft: 10}} />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  scroll: { padding: 20, paddingBottom: 50 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 40, marginBottom: 20, textAlign: 'center' },
  logText: { textAlign: 'center', color: '#666', marginBottom: 20 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 2 },
  balanceCard: { backgroundColor: '#e8f5e9', borderColor: '#c8e6c9', borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  value: { fontSize: 16, color: '#333', marginBottom: 15, fontWeight: '500' },
  address: { fontSize: 14, fontFamily: 'monospace', color: '#0066cc', marginBottom: 15, backgroundColor: '#f0f8ff', padding: 5, borderRadius: 4 },
  mnemonic: { fontSize: 14, color: '#555', fontStyle: 'italic' },
  bigBalance: { fontSize: 36, fontWeight: 'bold', color: '#2e7d32', marginBottom: 10 },
  smallBalance: { fontSize: 18, color: '#666', fontWeight: '600' },
  sats: { fontSize: 16, color: '#888', fontWeight: 'normal' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  loadingText: { marginTop: 10, fontSize: 16 },
});