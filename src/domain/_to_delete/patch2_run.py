path = "helpers.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = '''  const stopSpeaking = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch (e) {
      /* لا شيء */
    }
    setSpeakingId(null);
  };'''
new1 = '''  const stopSpeaking = () => {
    try {
      speakStopRef.current();
    } catch (e) {
      /* nothing to stop */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch (e) {
      /* لا شيء */
    }
    setSpeakingId(null);
  };'''
assert content.count(old1) == 1, "old1 count=" + str(content.count(old1))
content = content.replace(old1, new1)

old2 = '''      try {
        window.speechSynthesis?.cancel();
      } catch (e) {
        /* لا شيء قيد النطق */
      }
    };
  }, []);'''
new2 = '''      try {
        speakStopRef.current();
      } catch (e) {
        /* nothing to stop */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {
        /* لا شيء قيد النطق */
      }
    };
  }, []);'''
assert content.count(old2) == 1, "old2 count=" + str(content.count(old2))
content = content.replace(old2, new2)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
