import numpy as np, wave
rate=44100; duration=32; t=np.arange(rate*duration)/rate
mix=np.zeros(len(t)); rng=np.random.default_rng(42)
# Original 120 BPM synth score: warm arpeggios, bass, kick and soft hi-hats.
chords=[(57,60,64,69),(53,57,60,65),(48,52,55,60),(55,59,62,67)]
for beat in np.arange(0,duration,.5):
 start=int(beat*rate); end=min(len(t),start+int(.45*rate)); u=np.arange(end-start)/rate
 mix[start:end]+=.32*np.sin(2*np.pi*(48*u+36*(1-np.exp(-u*26))/26))*np.exp(-u*13)
 chord=chords[int(beat//4)%4]; freq=440*2**((chord[0]-24-69)/12)
 mix[start:end]+=.15*np.sin(2*np.pi*freq*u)*np.exp(-u*6)
for tick in np.arange(0,duration,.25):
 start=int(tick*rate);end=min(len(t),start+int(.5*rate));u=np.arange(end-start)/rate
 chord=chords[int(tick//4)%4];note=chord[int(tick*4)%4]+12;freq=440*2**((note-69)/12)
 env=(1-np.exp(-u*130))*np.exp(-u*8)
 mix[start:end]+=.08*(np.sin(2*np.pi*freq*u)+.25*np.sin(2*np.pi*freq*2*u))*env
 n=min(len(t)-start,int(.06*rate));mix[start:start+n]+=.025*rng.normal(size=n)*np.exp(-np.arange(n)/rate*90)
# Soft offbeat claps.
for beat in np.arange(.5,duration,1):
 start=int(beat*rate);n=min(len(t)-start,int(.12*rate));mix[start:start+n]+=.06*rng.normal(size=n)*np.exp(-np.arange(n)/rate*35)
mix=np.tanh(mix*1.5)*.8; stereo=np.stack((mix,mix*.98),axis=1)
with wave.open('/tmp/papeled-reel/music.wav','wb') as f:
 f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((stereo*32767).astype('<i2').tobytes())
