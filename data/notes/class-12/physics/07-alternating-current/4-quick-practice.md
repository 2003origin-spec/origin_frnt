---
title: "Alternating Current: Quick Practice"
type: practice
chapter: c12.physics.alternating-current
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. All ac values are rms unless a question says "peak".

## RMS values and pure elements

:::question{title="1. Reading the equation" exam="NEET level"}
The voltage $v = 200\sqrt2\,\sin(100\pi t)$ volt is applied across a 50 Ω resistor. Find the frequency, the rms current and the average power.

---

$\omega = 100\pi$ rad/s, so $\nu = \dfrac{100\pi}{2\pi} =$ **50 Hz**.

$V = \dfrac{200\sqrt2}{\sqrt2} = 200$ V, so $I = \dfrac{200}{50} =$ **4 A**.

$P = VI = 200 \times 4 =$ **800 W**.
:::

:::question{title="2. Zero to rms" exam="JEE Main level"}
A 50 Hz sinusoidal current starts from zero. What is the least time it takes to reach its rms value?

---

We need $i_m\sin\omega t = \dfrac{i_m}{\sqrt2}$, so $\omega t = \dfrac{\pi}{4}$, which is $\dfrac{T}{8}$.

$T = \dfrac{1}{50} = 0.02$ s, so $t = \dfrac{0.02}{8} =$ **2.5 ms**.
:::

:::question{title="3. Pure inductor" exam="NEET level"}
A pure inductor of $\dfrac{1}{\pi}$ H is connected to a 220 V, 50 Hz supply. Find the rms current and the average power used.

---

$X_L = 2\pi\nu L = 2\pi \times 50 \times \dfrac{1}{\pi} = 100\ \Omega$.

$I = \dfrac{220}{100} =$ **2.2 A**. The average power in a pure inductor is **zero** (current lags by $90^\circ$, $\cos 90^\circ = 0$).
:::

:::question{title="4. Capacitor and frequency" exam="NEET level"}
A capacitor draws 2 A from a 220 V, 50 Hz supply. What current does it draw from a 220 V, 100 Hz supply? What steady current does it draw from a 220 V dc supply?

---

$I = \dfrac{V}{X_C} = V\omega C$, so $I$ is proportional to the frequency. At 100 Hz, $I =$ **4 A**.

On dc it charges once and then the current stops: steady current **0**.
:::

## Series LCR and resonance

:::question{title="5. RL circuit, then tuning it" exam="JEE Main level"}
A 30 Ω resistor and an inductor with $X_L = 40\ \Omega$ (at 50 Hz) are in series across a 200 V, 50 Hz supply.

(a) Find the current, the power factor and the power.

(b) What capacitor, put in series, makes the power factor 1? What is the power then?

---

(a) $Z = \sqrt{30^2 + 40^2} = 50\ \Omega$, $I = \dfrac{200}{50} =$ **4 A**, $\cos\phi = \dfrac{30}{50} =$ **0.6**, $P = I^2R = 16 \times 30 =$ **480 W**.

(b) Need $X_C = X_L = 40\ \Omega$: $C = \dfrac{1}{2\pi \times 50 \times 40} = \dfrac{1}{4000\pi}$ F $\approx$ **79.6 μF**. Now $Z = R = 30\ \Omega$, so $P = \dfrac{V^2}{R} = \dfrac{40000}{30} \approx$ **1333 W**.
:::

:::question{title="6. Voltage across L at resonance" exam="JEE Main level"}
A series circuit has $L = 0.5$ H, $C = 8\ \mu$F and $R = 10\ \Omega$. It is joined to a 100 V supply whose frequency can be varied. At resonance, find the angular frequency, the current and the voltage across the inductor.

---

$\omega_0 = \dfrac{1}{\sqrt{0.5 \times 8\times10^{-6}}} = \dfrac{1}{2\times10^{-3}} =$ **500 rad/s**.

At resonance $Z = R$, so $I = \dfrac{100}{10} =$ **10 A**.

$V_L = I\omega_0L = 10 \times 500 \times 0.5 =$ **2500 V**, 25 times the supply voltage. $V_C$ is also 2500 V, opposite in phase, so they cancel.
:::

:::question{title="7. Leads or lags?" exam="NEET level"}
In a series LCR circuit, $R = 8\ \Omega$, $X_L = 10\ \Omega$ and $X_C = 4\ \Omega$, on a 100 V supply. Find the impedance and the power. Does the current lead or lag the voltage?

---

$Z = \sqrt{8^2 + (4 - 10)^2} = \sqrt{100} =$ **10 Ω**. $I = 10$ A, so $P = I^2R = 100 \times 8 =$ **800 W**.

$X_L > X_C$, so the circuit is inductive and the current **lags**, by $\tan^{-1}(6/8) \approx 37^\circ$.
:::

## Power and transformers

:::question{title="8. Wattless current" exam="NEET level"}
In an ac circuit, $V = 220$ V and $I = 5$ A, and the current lags the voltage by $60^\circ$. Find the average power and the wattless component of the current.

---

$P = VI\cos\phi = 220 \times 5 \times \tfrac12 =$ **550 W**.

Wattless current $= I\sin\phi = 5 \times \dfrac{\sqrt3}{2} \approx$ **4.33 A**.
:::

:::question{title="9. Real transformer" exam="NEET level"}
A transformer steps 2200 V down to 220 V. Its primary has 3000 turns. It is 90% efficient and gives 9 A at 220 V. Find the secondary turns and the primary current.

---

$N_s = 3000 \times \dfrac{220}{2200} =$ **300 turns**.

Output $= 220 \times 9 = 1980$ W. Input $= \dfrac{1980}{0.9} = 2200$ W, so $I_p = \dfrac{2200}{2200} =$ **1 A**.
:::

:::question{title="10. Why high voltage?" exam="JEE Main level"}
100 kW is sent through lines of total resistance 5 Ω, at power factor 1. Find the power lost in the lines if it is sent at (a) 1 kV and (b) 10 kV. Take the line current as $P/V$.

---

(a) $I = \dfrac{100000}{1000} = 100$ A. Loss $= I^2R = 100^2 \times 5 =$ **50 kW** (half the power).

(b) $I = 10$ A. Loss $= 10^2 \times 5 =$ **500 W**.

Ten times the voltage gives one-tenth the current and **one-hundredth** the loss.
:::
