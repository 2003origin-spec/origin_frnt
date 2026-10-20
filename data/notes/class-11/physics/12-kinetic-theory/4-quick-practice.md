---
title: "Kinetic Theory: Quick Practice"
type: practice
chapter: c11.physics.kinetic-theory
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Use $R = 8.31$ J mol⁻¹ K⁻¹ and $k_B = 1.38\times10^{-23}$ J/K.

## Gas laws

:::question{title="1. Heating a closed tank" exam="NEET level"}
A rigid, sealed tank holds a gas at 27 °C and 2.0 atm. It is heated to 177 °C. Find the new pressure.

---

Volume and amount are fixed, so $P \propto T$ (in kelvin). $T$ goes from 300 K to 450 K.
$P_2 = 2.0 \times \dfrac{450}{300} =$ **3.0 atm**.
:::

:::question{title="2. Counting molecules" exam="NEET level"}
A gas is at a pressure of $4.14\times10^5$ Pa and a temperature of 300 K. How many molecules are there in 1 cm³ of it?

---

$n = \dfrac{P}{k_BT}$. Here $k_BT = 1.38\times10^{-23}\times300 = 4.14\times10^{-21}$ J.

So $n = \dfrac{4.14\times10^5}{4.14\times10^{-21}} = 10^{26}$ m⁻³.

1 cm³ $= 10^{-6}$ m³, so the number is $10^{26}\times10^{-6} =$ **$10^{20}$ molecules**.
:::

:::question{title="3. Partial pressures" exam="NEET level"}
A vessel holds 2 g of hydrogen (H₂) and 8 g of oxygen (O₂). They do not react. The total pressure is 2.5 atm. Find the partial pressure of oxygen.

---

Moles: H₂ $= 2/2 = 1$ mol, O₂ $= 8/32 = 0.25$ mol. Partial pressures are in the ratio of moles.
$P_{O_2} = \dfrac{0.25}{1.25}\times2.5 =$ **0.5 atm**.
:::

## Molecular speeds

:::question{title="4. Doubling the rms speed" exam="NEET level"}
A gas is at 27 °C. To what temperature must it be heated so that the rms speed of its molecules doubles?

---

$v_{rms} \propto \sqrt T$, so $T$ must become 4 times: $4\times300 = 1200$ K, which is **927 °C**.
:::

:::question{title="5. Speed from pressure and density" exam="NEET level"}
A gas has density 1.2 kg/m³ at a pressure of $1.0\times10^5$ Pa. Find the rms speed of its molecules.

---

$v_{rms} = \sqrt{\dfrac{3P}{\rho}} = \sqrt{\dfrac{3\times10^5}{1.2}} = \sqrt{2.5\times10^5} =$ **500 m/s**.
:::

:::question{title="6. Mean speed vs rms speed" exam="JEE Main level"}
Five molecules have speeds 1, 2, 3, 4 and 5 km/s. Find their mean speed and their rms speed.

---

Mean speed $= \dfrac{1+2+3+4+5}{5} =$ **3 km/s**.

Mean of squares $= \dfrac{1+4+9+16+25}{5} = 11$, so $v_{rms} = \sqrt{11} \approx$ **3.32 km/s**. The rms speed is larger, because $\overline{v^2} \ne (\bar v)^2$.
:::

## Equipartition and specific heats

:::question{title="7. Internal energy" exam="NEET level"}
Find the internal energy of 2 mol of a rigid diatomic ideal gas at 300 K.

---

Rigid diatomic: 5 degrees of freedom in total ($D = 5$), so $U = \dfrac52\mu RT = \dfrac52\times2\times8.31\times300 = 12465$ J $\approx$ **12.5 kJ**.
:::

:::question{title="8. Heating nitrogen at constant pressure" exam="JEE Main level"}
28 g of nitrogen (rigid diatomic) is heated at constant pressure from 300 K to 310 K. Find the heat given and the increase in internal energy.

---

$\mu = 28/28 = 1$ mol, $\Delta T = 10$ K.

Heat $= \mu C_p\Delta T = \tfrac72\times8.31\times10 \approx$ **291 J**.

$\Delta U = \mu C_v\Delta T = \tfrac52\times8.31\times10 \approx$ **208 J**. The other 83 J is the work done as the gas expands.
:::

:::question{title="9. Gamma of a mixture" exam="JEE Main level"}
1 mol of helium is mixed with 1 mol of oxygen (rigid diatomic). Find $\gamma$ for the mixture.

---

$C_v = \dfrac{1\times\tfrac32R + 1\times\tfrac52R}{2} = 2R$, so $C_p = 2R + R = 3R$.

$\gamma = \dfrac{3R}{2R} =$ **1.5**. (Averaging 1.67 and 1.40 would give the wrong answer, 1.53.)
:::

## Mean free path

:::question{title="10. Mean free path" exam="JEE Main level"}
A gas has $2.5\times10^{25}$ molecules per m³. Each molecule has a diameter of $3\times10^{-10}$ m. Find the mean free path. What happens to it if the pressure is halved at the same temperature?

---

$l = \dfrac{1}{\sqrt2\,n\pi d^2}$. Here $n\pi d^2 = 2.5\times10^{25}\times3.14\times9\times10^{-20} \approx 7.07\times10^6$ m⁻¹.

$l = \dfrac{1}{1.414\times7.07\times10^6} \approx$ **$1.0\times10^{-7}$ m**.

Halving $P$ at fixed $T$ halves $n$, so $l$ **doubles** to about $2\times10^{-7}$ m.
:::
