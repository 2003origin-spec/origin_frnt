---
title: "Waves: Quick Practice"
type: practice
chapter: c11.physics.waves
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Ignore end corrections in pipe questions.

## The wave equation

:::question{title="1. Reading a wave" exam="NEET level"}
A wave on a string is $y = 0.02\sin(4\pi x - 200\pi t)$, with $x$ and $y$ in metres and $t$ in seconds. Find its amplitude, wavelength, frequency, speed and direction.

---

Amplitude $a = 0.02$ m. $k = 4\pi$, so $\lambda = \dfrac{2\pi}{4\pi} = 0.5$ m. $\omega = 200\pi$, so $\nu = \dfrac{200\pi}{2\pi} = 100$ Hz. $v = \dfrac{\omega}{k} = \dfrac{200\pi}{4\pi} = 50$ m/s (check: $\nu\lambda = 100 \times 0.5 = 50$).

$x$ and $t$ have opposite signs, so it moves along $+x$. **a = 2 cm, λ = 0.5 m, ν = 100 Hz, v = 50 m/s along +x.**
:::

:::question{title="2. Particle speed vs wave speed" exam="JEE Main level"}
For the wave in Question 1, find the largest speed of a particle of the string. What is its ratio to the wave speed?

---

Largest particle speed $= a\omega = 0.02 \times 200\pi = 4\pi \approx$ **12.6 m/s**.

Ratio $= \dfrac{a\omega}{\omega/k} = ak = 0.02 \times 4\pi = 0.08\pi \approx$ **0.25**. The particles move about 4 times more slowly than the wave.
:::

:::question{title="3. Phase difference" exam="NEET level"}
A sound wave of frequency 500 Hz travels at 300 m/s. What is the phase difference between two points on its path 10 cm apart?

---

$\lambda = \dfrac{v}{\nu} = \dfrac{300}{500} = 0.6$ m.

$\Delta\phi = \dfrac{2\pi}{\lambda}\Delta x = \dfrac{2\pi \times 0.1}{0.6} =$ **π/3 rad (60°)**.
:::

## Speed of waves

:::question{title="4. Wave on a string" exam="NEET level"}
A string 2 m long has a mass of 20 g and is stretched with a tension of 100 N. Find the speed of a transverse wave on it. What will the speed be if the tension is made 4 times?

---

$\mu = \dfrac{0.02}{2} = 0.01$ kg/m. $v = \sqrt{\dfrac{T}{\mu}} = \sqrt{\dfrac{100}{0.01}} =$ **100 m/s**.

$v \propto \sqrt T$, so 4 times the tension gives 2 times the speed: **200 m/s**.
:::

:::question{title="5. Speed and temperature" exam="NEET level"}
The speed of sound in air is 340 m/s at 27 °C. At what temperature will it be 680 m/s?

---

$v \propto \sqrt T$ with $T$ in kelvin. Doubling $v$ needs 4 times $T$: $T = 4 \times 300 = 1200$ K, which is **1200 K (927 °C)**.
:::

## Superposition and standing waves

:::question{title="6. Two waves together" exam="NEET level"}
Two waves of the same frequency, each of amplitude 4 mm, travel the same way along a string with a phase difference of $2\pi/3$. Find the amplitude of the resultant wave.

---

$A = 2a\cos\dfrac{\phi}{2} = 2 \times 4 \times \cos 60^\circ =$ **4 mm**. (With a phase difference of $\pi$ it would be zero.)
:::

:::question{title="7. String harmonics" exam="NEET level"}
A string 1.5 m long is fixed at both ends. Waves travel on it at 300 m/s. Find its fundamental frequency, the frequency of its 3rd harmonic, and the number of nodes (ends included) in the 3rd harmonic.

---

$\nu_1 = \dfrac{v}{2L} = \dfrac{300}{3} =$ **100 Hz**. 3rd harmonic $= 3 \times 100 =$ **300 Hz**.

The 3rd harmonic has 3 loops, so **4 nodes** (2 ends + 2 in between).
:::

:::question{title="8. Closing one end" exam="JEE Main level"}
A pipe open at both ends has a fundamental frequency of 300 Hz. One end is now closed. Find the new fundamental frequency and the frequency of the first overtone.

---

Open: $\dfrac{v}{2L} = 300$ Hz. Closed: $\dfrac{v}{4L} = \dfrac{300}{2} =$ **150 Hz**.

A closed pipe has only odd harmonics, so its first overtone is the 3rd harmonic: $3 \times 150 =$ **450 Hz**.
:::

:::question{title="9. Counting the modes" exam="JEE Main level"}
A pipe 85 cm long is closed at one end. The speed of sound is 340 m/s. How many of its natural frequencies are below 1250 Hz?

---

$\nu_1 = \dfrac{v}{4L} = \dfrac{340}{4 \times 0.85} = 100$ Hz. Only odd harmonics occur: 100, 300, 500, 700, 900, 1100 Hz (the next, 1300 Hz, is above 1250 Hz).

That makes **6** frequencies.
:::

## Beats

:::question{title="10. Tuning by beats" exam="JEE Main level"}
A tuning fork of 320 Hz and a stretched string B, sounded together, give 5 beats per second. The tension in B is then reduced slowly, and the beat frequency rises steadily to 7 beats per second. What was the original frequency of B?

---

B is $320 \pm 5$, so 315 Hz or 325 Hz. Reducing the tension **lowers** B's frequency.

If B were 325 Hz, lowering it would move it towards 320 Hz and the beats would first **fall**. If B is 315 Hz, lowering it moves it away from 320 Hz, so the beats **rise** (to 7 at 313 Hz). So B was **315 Hz**.
:::
