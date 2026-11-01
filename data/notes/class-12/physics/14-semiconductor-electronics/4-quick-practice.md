---
title: "Semiconductor Electronics: Quick Practice"
type: practice
chapter: c12.physics.semiconductor-electronics
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise (no question here needs it). Where a wavelength is needed, take $hc = 1240$ eV nm.

## Materials and doping

:::question{title="1. Indium in silicon" exam="NEET level"}
Pure silicon is doped with a small amount of indium. What type of semiconductor is formed, what are its majority carriers, and what is the net charge on the crystal?

---

Indium is trivalent (an acceptor), so the crystal is **p-type**, the majority carriers are **holes**, and the crystal is **electrically neutral** (net charge zero): the holes are balanced by the fixed negative acceptor ions.
:::

:::question{title="2. Minority carriers" exam="JEE Main level"}
Silicon has $5\times10^{28}$ atoms m⁻³ and $n_i = 1.5\times10^{16}$ m⁻³. It is doped with boron at 2 ppm (2 boron atoms per $10^6$ Si atoms). Find the electron concentration. Assume every boron atom is ionised.

---

$N_A = 2\times10^{-6}\times 5\times10^{28} = 10^{23}$ m⁻³. Since $N_A \gg n_i$, $n_h \approx 10^{23}$ m⁻³.

$n_e = \dfrac{n_i^2}{n_h} = \dfrac{2.25\times10^{32}}{10^{23}} =$ **2.25 × 10⁹ m⁻³**.
:::

## The diode and rectifiers

:::question{title="3. Dynamic resistance" exam="NEET level"}
On the forward characteristic of a diode, the current rises from 20 mA to 30 mA when the voltage rises from 0.70 V to 0.75 V. Find the dynamic resistance in this range.

---

$r_d = \dfrac{\Delta V}{\Delta I} = \dfrac{0.05\ \text{V}}{0.010\ \text{A}} =$ **5 Ω**.
:::

:::question{title="4. Diode with a resistor" exam="JEE Main level"}
A 5 V battery, a silicon diode and a 430 Ω resistor are in series, with the diode forward biased. Take the drop across the conducting diode as 0.7 V and ignore its resistance. Find the current. What is the current (roughly) if the diode is turned round?

---

$I = \dfrac{5 - 0.7}{430} = \dfrac{4.3}{430} = 0.01$ A $=$ **10 mA**.

Turned round, the diode is reverse biased: only the tiny reverse saturation current (µA) flows, so $I \approx$ **0**.
:::

:::question{title="5. Full-wave output" exam="NEET level"}
A 60 Hz ac supply feeds a centre-tap full-wave rectifier. What is the frequency of the output, and how many diodes conduct at any instant?

---

Each half-cycle gives one output pulse, so the output frequency is $2 \times 60 =$ **120 Hz**. Only **one** diode conducts at a time; the two take turns.
:::

## Special diodes (exam extra)

:::question{title="6. Colour of an LED" exam="NEET level"}
The semiconductor in an LED has a band gap of 2.0 eV. About what wavelength does it emit?

---

Photon energy ≈ $E_g$, so $\lambda = \dfrac{1240}{2.0} =$ **620 nm** (red-orange light).
:::

:::question{title="7. What a photodiode sees" exam="NEET level"}
A photodiode is made from a semiconductor with $E_g = 2.5$ eV. Which of these wavelengths can it detect: 400 nm, 450 nm, 550 nm, 700 nm?

---

$\lambda_{max} = \dfrac{1240}{2.5} = 496$ nm. Only light shorter than this has $h\nu \ge E_g$, so it detects **only 400 nm and 450 nm**.
:::

:::question{title="8. Zener regulator" exam="JEE Main level"}
A Zener diode with $V_Z = 6$ V is used with a series resistor of 200 Ω and a load of 1 kΩ. The input is 10 V. Find the current through the Zener.

---

Check breakdown: without the Zener, the load would get $10 \times \dfrac{1000}{1200} \approx 8.3$ V $> 6$ V, so the Zener is in breakdown and the load voltage is 6 V.

$I_s = \dfrac{10 - 6}{200} = 20$ mA, $I_L = \dfrac{6}{1000} = 6$ mA, so $I_Z = 20 - 6 =$ **14 mA**.
:::

## Logic gates (exam extra)

:::question{title="9. Which gate is it?" exam="NEET level"}
Input A passes through a NOT gate and input B passes through another NOT gate. The two outputs go into a NAND gate. Which single gate does this circuit act as?

---

$Y = \overline{\overline{A}\cdot\overline{B}} = A + B$ (De Morgan). Check: A = B = 0 gives NAND(1, 1) = 0; A = 1, B = 0 gives NAND(0, 1) = 1. It is an **OR gate**.
:::

:::question{title="10. Two gates in a row" exam="JEE Main level"}
A and B are the inputs of an AND gate. Its output and a third input C go into a NOR gate, whose output is Y. Find Y for (a) A = 1, B = 1, C = 0 and (b) A = 0, B = 1, C = 0.

---

(a) AND(1, 1) = 1; NOR(1, 0) = 0, so **Y = 0**.

(b) AND(0, 1) = 0; NOR(0, 0) = 1, so **Y = 1**.
:::
