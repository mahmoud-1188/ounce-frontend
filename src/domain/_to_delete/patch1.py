path = "helpers.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);'''
new = '''  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);
  const speakStopRef = useRef(() => {});'''

assert content.count(old) == 1, "count=" + str(content.count(old))
content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
