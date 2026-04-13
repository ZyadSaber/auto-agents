# 🖥️ Server Optimization Guide: Dell PowerEdge R620

To utilize your **Dell R620 (128GB RAM / 16 Cores)** to its full potential, follow these specific configurations.

> [!WARNING]
> I detected that we are currently running on an **HP ZBook Laptop** (16GB RAM). To use the server, ensure these files are copied to the Dell Server and executed there.

## 1. Top Recommended LLM Models
With 128GB of RAM, you can run professional-grade models that smaller machines cannot handle.

*   **🏆 Best for Performance & Intelligence:** `llama3:70b`
    *   *RAM used:* ~40GB (Quantized).
    *   *Notes:* This is the current "gold standard" for open-source AI. It will use your RAM bandwidth effectively.
*   **📚 Best for Long Documents (RAG):** `command-r:35b`
    *   *RAM used:* ~24GB.
    *   *Notes:* Optimized for "Retrieval Augmented Generation," perfect for the Docs Agent.
*   **🧠 Maximum Logic:** `qwen2:72b`
    *   *RAM used:* ~45GB.
    *   *Notes:* Highly capable at complex reasoning and math.

---

## 2. Optimized `docker-compose.yml` for Server
Replace the Ollama section in your compose file with these settings:

```yaml
  ollama:
    # ... other settings ...
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      # Set to match your physical cores (8 cores per CPU = 16 total)
      - OLLAMA_NUM_THREAD=16
      # Limit parallel requests to keep CPU latency low for large models
      - OLLAMA_NUM_PARALLEL=1
      - OLLAMA_MAX_LOADED_MODELS=3
    deploy:
      resources:
        limits:
          cpus: "15"     # Leave 1 core for Windows
          memory: 110G   # Leave 18GB for Windows
        reservations:
          cpus: "12"
          memory: 64G
```

---

## 3. Critical Windows Server / Docker Fixes

### A. Unlock RAM via `.wslconfig`
By default, Docker/WSL2 on Windows only uses 50% of your RAM. You **must** override this.
1. Create a file at `C:\Users\<YourUser>\.wslconfig`
2. Add the following content:
```ini
[wsl2]
memory=110GB  # Limits the VM to 110GB
processors=16 # Limits the VM to 16 cores
```
3. Restart WSL by running `wsl --shutdown` in PowerShell.

### B. BIOS / Hardware Settings
*   **Logical Processors (Hyper-threading):** Ensure this is **Enabled** in the Dell BIOS.
*   **System Profile:** Set to **Performance** (not Energy Efficient) in the BIOS.
*   **Virtualization Technology:** Ensure **VT-x** and **VT-d** are enabled.

---

## 4. Why it might still feel "Slow"
The **Xeon E5-2650 v1** is a 2012 processor. While it has 16 cores, it lacks **AVX2** instructions (introduced in v3).
*   **Impact:** Modern AI models use AVX2 for math. Without it, your server will be about 3x to 5x slower than a modern CPU, even with more cores.
*   **Solution:** Use **GGUF (Quantized)** models which are optimized for CPU, and ensure you use the `8b` or `32b` versions if `70b` is too slow for real-time chat.

**Would you like me to generate a new `docker-compose.yml` specifically for your server specs?**
