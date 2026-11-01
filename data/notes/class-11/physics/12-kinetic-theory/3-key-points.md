---
title: "Kinetic Theory: Important Points and Traps"
type: key_points
chapter: c11.physics.kinetic-theory
order: 3
---

## Gas laws

:::trap
Always put $T$ in **kelvin**. Heating a gas at fixed volume from 27 °C to 54 °C does **not** double the pressure. It goes from 300 K to 327 K, only about 9% more.
:::

:::trap
In $v_{rms} = \sqrt{3RT/M_0}$ and $P = \rho RT/M_0$, the molar mass $M_0$ must be in **kg/mol**. For O₂ use 0.032, not 32.
:::

- $\dfrac{P_1V_1}{T_1} = \dfrac{P_2V_2}{T_2}$ works only when the **amount of gas is fixed**. If gas leaks out or is pumped in, use $PV = \mu RT$ for each state.
- Real gases behave ideally at **low pressure and high temperature**, not the other way round.
- Each gas in a mixture behaves as if it **alone** filled the whole vessel. The partial pressures are in the ratio of the **moles**, not the masses.

:::trap
"Gay Lussac's law" in this NCERT chapter means the law of **combining volumes** of reacting gases. Some books use the same name for $P \propto T$ at fixed volume. Read the question carefully.
:::

## Pressure and temperature

- The average KE per molecule, $\tfrac32k_BT$, is the **same for all gases** at the same temperature. It does not depend on the mass, pressure or volume.
- The rms speed **does** depend on the mass: at the same $T$, $v_{rms} \propto 1/\sqrt{M_0}$. H₂ is 4 times faster than O₂.
- $v_{rms} \propto \sqrt T$. To double $v_{rms}$, make $T$ (in K) **four** times.
- The internal energy of a given ideal gas depends **only on $T$**, not on $P$ or $V$ separately.
- Pressure $= \tfrac23 \times$ (translational KE per unit volume).

:::trap
$\tfrac32k_BT$ is the **translational** KE only. The **total** energy of a diatomic molecule is $\tfrac52k_BT$ (rigid). Read whether the question asks for "translational" or "total" energy.
:::

:::trap
$\overline{v^2}$ is **not** the same as $(\bar v)^2$. The mean of the squares is not the square of the mean (NCERT). That is why $v_{rms}$ is a little more than the mean speed.
:::

- (Exam extra) $v_{rms} > v_{avg} > v_{mp}$ for every gas at every temperature.
- (Exam extra) Temperature comes from the **random** motion of molecules. Moving the whole container at a steady velocity does not change the temperature of the gas inside.

## Degrees of freedom and specific heats

:::trap
A **vibrational mode** gives $k_BT$, not $\tfrac12k_BT$, because it has two squared terms (KE and PE). So a vibrating diatomic molecule has **7** degrees of freedom in total (3 + 2 + 2), not 6.
:::

:::trap
**Two meanings of $f$.** In NCERT's polyatomic formula $C_v = (3 + f)R$, $f$ is the number of **vibrational modes**. Many exam books instead use $f$ for the **total** degrees of freedom and write $C_v = \tfrac f2R$. In these notes the total is called $D$, so $C_v = \tfrac D2R$. In a question, check which meaning is used: a rigid polyatomic gas has $D = 6$ but $f = 0$.
:::

- A diatomic molecule has **2** rotational degrees of freedom, not 3. Rotation about the line joining the atoms does not count.
- More degrees of freedom means a **larger** $C_v$ but a **smaller** $\gamma$. For an ideal gas, $\gamma$ is more than 1 and at most $\tfrac53$ (monatomic).
- $C_p - C_v = R$ is for **molar** specific heats. Per kg it is $R/M_0$.
- (Exam extra) For a mixture, add the $\mu C_v$ values, find $C_v$ of the mixture, then $\gamma$. Never take the plain average of the $\gamma$ values.
- Measured specific heats of gases like Cl₂ and C₂H₆ are **higher** than the rigid-molecule prediction, because vibration also takes energy.
- Solids: $C = 3R \approx 25$ J mol⁻¹ K⁻¹ at room temperature. Carbon is the exception NCERT names.

:::tip
**Count 3–5–7:** total degrees of freedom $D$ = 3 (monatomic), 5 (rigid diatomic), 7 (diatomic with vibration). Then
$C_v = \tfrac D2R$ and $\gamma = 1 + \tfrac2D$, so $\gamma$ = 5/3, 7/5, 9/7.
:::

:::tip
For the speeds (exam extra), remember the numbers under the root: $v_{mp} : v_{avg} : v_{rms} = \sqrt2 : \sqrt{8/\pi} : \sqrt3$. As $\sqrt{8/\pi} \approx \sqrt{2.55}$, the order is clear: 2 < 2.55 < 3.
:::

## Mean free path

- $l = \dfrac{1}{\sqrt2\,n\pi d^2}$ depends on number density and **diameter**. If a question gives the radius, use $d = 2r$.
- At a fixed temperature, $l \propto 1/P$. At a fixed pressure, $l \propto T$ (because $n = P/k_BT$).
- In a closed rigid vessel ($n$ fixed), heating the gas does **not** change $l$. It only makes collisions more frequent.

:::trap
The time **between** collisions ($\tau = l/\bar v$) is very different from the time a collision **lasts**. A collision is far shorter. Don't mix them up.
:::

## NCERT lines to know

:::remember
- At ordinary pressure and temperature, the distance between gas molecules is only about **10 times** the size of a molecule.
- The mean free path in a gas is about **100 times** the distance between molecules and about **1000 times** the size of a molecule.
- Pressure exists everywhere in a fluid, not only on the walls.
- Air molecules do not settle on the floor, because their KE is much larger than $mgh$ for ordinary heights. The density is only very slightly higher lower down.
- The average KE of a molecule is proportional to the absolute temperature. It is independent of pressure, volume and the nature of the ideal gas.
:::
