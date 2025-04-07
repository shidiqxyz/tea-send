require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

// Konfigurasi jaringan Tea Sepolia Testnet
const chainConfig = {
  chainId: "0x27ea", // 10218 dalam desimal
  chainName: "Tea Sepolia Testnet",
  nativeCurrency: {
    name: "TEA",
    symbol: "TEA",
    decimals: 18,
  },
  rpcUrls: ["https://tea-sepolia.g.alchemy.com/public"],
  blockExplorerUrls: ["https://sepolia.tea.xyz/"]
};

// Fungsi untuk membaca file alamat dan melakukan validasi
function loadAddresses(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const addresses = data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    if (addresses.length === 0) {
      throw new Error("Daftar alamat kosong.");
    }
    return addresses;
  } catch (err) {
    throw new Error(`Gagal membaca file alamat: ${err.message}`);
  }
}

// Fungsi untuk mengacak array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Fungsi untuk mengambil dan validasi private keys dari env
function loadPrivateKeys() {
  const pkEnv = process.env.PKS;
  if (!pkEnv) {
    throw new Error("Environment variable 'PKS' tidak ditemukan.");
  }
  const pks = pkEnv
    .split(',')
    .map(pk => pk.trim())
    .filter(pk => pk !== '');
  if (pks.length === 0) {
    throw new Error("Tidak ada private key yang valid dalam environment variable 'PKS'.");
  }
  return pks;
}

// Fungsi delay untuk jeda antar transaksi (ms)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Membaca dan mengacak file alamat
  let addresses;
  try {
    addresses = loadAddresses('addresses.txt');
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
  addresses = shuffleArray(addresses);

  // Jumlah transaksi maksimum per private key, bisa diatur melalui env atau default 5
  const maxTx = Number(process.env.MAX_TX) || 123;
  const pks = loadPrivateKeys();

  // Buat provider
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrls[0], {
    name: chainConfig.chainName,
    chainId: parseInt(chainConfig.chainId, 16)
  });

  // Array untuk menyimpan ringkasan hasil per private key
  const summaryResults = [];

  // Proses setiap private key secara berurutan
  for (let i = 0; i < pks.length; i++) {
    const pk = pks[i];
    const wallet = new ethers.Wallet(pk, provider);
    let successCount = 0;
    let failCount = 0;
    let totalTx = 0;

    console.log(`\n🔑 Menggunakan private key ke-${i + 1} (${wallet.address})`);

    // Lakukan transaksi hingga mencapai maksimal maxTx atau alamat habis
    for (let j = 1; j <= maxTx; j++) {
      if (addresses.length === 0) {
        console.log("📭 Tidak ada lagi alamat yang tersisa.");
        break;
      }
      const recipient = addresses.shift();
      totalTx++;

      console.log(`\n🚀 Mengirim TX ke ${recipient} dari ${wallet.address}`);
      try {
        // Ambil data fee terkini dan tambah multiplier untuk instant TX
        const feeData = await provider.getFeeData();
        const multiplier = 1.5;
        const maxFeePerGas = feeData.maxFeePerGas
          ? feeData.maxFeePerGas.mul(ethers.BigNumber.from(Math.floor(multiplier * 100))).div(ethers.BigNumber.from(100))
          : undefined;
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
          ? feeData.maxPriorityFeePerGas.mul(ethers.BigNumber.from(Math.floor(multiplier * 100))).div(ethers.BigNumber.from(100))
          : undefined;

        const tx = {
          to: recipient,
          value: ethers.utils.parseEther("0.001"),
          ...(maxFeePerGas && maxPriorityFeePerGas
            ? { maxFeePerGas, maxPriorityFeePerGas }
            : { gasPrice: feeData.gasPrice }),
        };

        const txResponse = await wallet.sendTransaction(tx);
        console.log(`✅ Terkirim: ${txResponse.hash}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Gagal: ${error.message}`);
        failCount++;
      }

      // Jeda acak antara 2 - 5 detik sebelum transaksi berikutnya
      const waitTime = Math.floor(Math.random() * (3000 - 2000 + 1)) + 3000;
      console.log(`⏳ Tunggu ${waitTime / 1000} detik...`);
      await delay(waitTime);
    }

    // Simpan hasil ringkasan untuk private key ini
    summaryResults.push({
      "Akun Pengirim": wallet.address,
      "TX ✅": successCount,
      "TX ❌": failCount,
      "Jumlah TX": totalTx
    });
  }

  // Tampilkan ringkasan hasil transaksi dalam bentuk tabel
  console.log("\n📊 Ringkasan Transaksi:");
  console.table(summaryResults);
  console.log("🚀 Selesai mengirim semua transaksi!");
}

main()
  .catch(error => {
    console.error("Terjadi kesalahan di proses utama:", error.message);
    process.exit(1);
  });
