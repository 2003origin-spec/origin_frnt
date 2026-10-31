---
title: "Oscillations: Quick Practice"
type: practice
chapter: c11.physics.oscillations
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise.

## Describing SHM

:::question{title="1. Reading the equation" exam="NEET level"}
A particle moves as $x = 0.05\cos(10\pi t + \pi/3)$, with $x$ in metres and $t$ in seconds. Find its amplitude, period and largest speed.

---

Amplitude $A =$ **0.05 m**. $\omega = 10\pi$ rad/s, so $T = \dfrac{2\pi}{10\pi} =$ **0.2 s** (frequency 5 Hz).

$v_{max} = \omega A = 10\pi \times 0.05 = 0.5\pi \approx$ **1.57 m/s**.
:::

:::question{title="2. Which one is SHM?" exam="NEET level"}
Which of these is simple harmonic motion, and what is its amplitude?

(i) $x = 3\sin\omega t + 4\cos\omega t$ (ii) $x = \sin\omega t + \sin 2\omega t$ (iii) $x = e^{-\omega t}$

---

(i) is SHM: a sine and a cosine with the **same** $\omega$ combine into one sine wave of amplitude $\sqrt{3^2 + 4^2} =$ **5**. (ii) is periodic but not SHM (two different $\omega$ values). (iii) is not periodic.
:::

:::question{title="3. Speed and acceleration at a point" exam="NEET level"}
A particle does SHM with amplitude 5 cm and angular frequency 4 rad/s. Find its speed and the size of its acceleration when it is 3 cm from the mean position.

---

$v = \omega\sqrt{A^2 - x^2} = 4\sqrt{25 - 9} = 4 \times 4 =$ **16 cm/s**.

$|a| = \omega^2 x = 16 \times 3 =$ **48 cm/s²** (0.48 m/s²).
:::

:::question{title="4. Time to half the amplitude" exam="JEE Main level"}
A particle in SHM has period 1.2 s. It starts from the mean position. How long does it take to reach half the amplitude for the first time?

---

Starting at the mean position, $x = A\sin\omega t$. Set $x = A/2$: $\sin\omega t = \tfrac12$, so $\omega t = \pi/6$.

$t = \dfrac{\pi/6}{2\pi/T} = \dfrac{T}{12} = \dfrac{1.2}{12} =$ **0.1 s**.
:::

## Springs and energy

:::question{title="5. Block on a spring" exam="NEET level"}
A 0.5 kg block on a smooth floor is fixed to a spring of constant 200 N/m. It is pulled 4 cm from the mean position and released. Find the period, the largest speed and the largest acceleration.

---

$\omega = \sqrt{k/m} = \sqrt{200/0.5} = 20$ rad/s, so $T = \dfrac{2\pi}{20} = \dfrac{\pi}{10} \approx$ **0.314 s**.

$v_{max} = \omega A = 20 \times 0.04 =$ **0.8 m/s**. $a_{max} = \omega^2 A = 400 \times 0.04 =$ **16 m/s²**.
:::

:::question{title="6. Hanging spring" exam="JEE Main level"}
A mass hung from a light spring stretches it by 2.5 cm and rests. It is then pulled down a little and released. Find the period of its oscillations.

---

At rest $kx_0 = mg$, so $\dfrac{k}{m} = \dfrac{g}{x_0} = \dfrac{10}{0.025} = 400$ s⁻², and $\omega = 20$ rad/s.

$T = 2\pi\sqrt{\dfrac{x_0}{g}} = \dfrac{2\pi}{20} = \dfrac{\pi}{10} \approx$ **0.314 s**.
:::

:::question{title="7. Sharing the energy" exam="NEET level"}
A block on a spring of constant 200 N/m oscillates with amplitude 10 cm. Find the total energy, and the kinetic energy when the displacement is 5 cm.

---

$E = \tfrac12 kA^2 = \tfrac12 \times 200 \times (0.1)^2 =$ **1 J**.

At $x = 0.05$ m: $U = \tfrac12 \times 200 \times (0.05)^2 = 0.25$ J, so $K = 1 - 0.25 =$ **0.75 J**.
:::

:::question{title="8. Kinetic is three times potential" exam="JEE Main level"}
In SHM of amplitude $A$, at what displacement is the kinetic energy three times the potential energy?

---

$K = 3U$ means $E = K + U = 4U$. So $\tfrac12 kA^2 = 4 \times \tfrac12 kx^2$, giving $x^2 = A^2/4$ and $x =$ **±A/2**.
:::

## Simple pendulum

:::question{title="9. Longer string" exam="NEET level"}
The length of a simple pendulum is increased by 44%. By what percentage does its period change?

---

$T \propto \sqrt L$, so $\dfrac{T'}{T} = \sqrt{1.44} = 1.2$. The period **increases by 20%**.
:::

:::question{title="10. On another planet" exam="NEET level"}
A simple pendulum has a period of 2 s on Earth. What is its period on a planet where the acceleration due to gravity is one-quarter of Earth's?

---

$T \propto \dfrac{1}{\sqrt g}$, so $T' = 2 \times \sqrt4 =$ **4 s**.
:::
