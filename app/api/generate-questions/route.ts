let response;
    let lastError = '';

    // SENARAI MODEL: Dari Generasi Paling Terkini (3.5) menurun ke versi lama
    // Sistem akan secara automatik mencari model mana yang aktif pada API Key Prof
    const candidateModels = [
      'gemini-3.5-pro',       // Model Genius Terkini
      'gemini-3.5-flash',     // Model Pantas Terkini
      'gemini-2.5-pro',       // Model Genius Stabil
      'gemini-2.5-flash',     // Model Pantas Stabil
      'gemini-2.0-flash',
      'gemini-1.5-pro'
    ];

    for (const modelName of candidateModels) {
      try {
        console.log(`Mencuba penjanaan dengan model: ${modelName}...`);
        response = await ai.models.generateContent({ 
          model: modelName, 
          contents: prompt 
        });
        // Jika berjaya dan ada teks jawapan, terus berhenti mencuba
        if (response && response.text) {
          console.log(`[BERJAYA] Menggunakan model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err.message || JSON.stringify(err);
        console.warn(`[Model ${modelName} Gagal]: ${lastError}`);
      }
    }

    if (!response || !response.text) {
      throw new Error(`Google AI API Error: ${lastError || 'Semua model gagal atau tidak wujud pada API Key anda.'}`);
    }