---
title: "Respiration in Plants: Key Terms and Tables Sheet"
type: formula_sheet
chapter: c11.biology.respiration-in-plants
order: 1
---

## The overall reaction

:::formula{title="Complete oxidation of glucose"}
$$\begin{aligned} & \ce{C6H12O6 + 6O2} \\ & \ce{-> 6CO2 + 6H2O} \end{aligned}$$
plus energy.

In combustion most of the energy is lost as heat. In the cell the same change happens in many small enzyme-controlled steps, so part of the energy is trapped as **ATP**.
:::

## Where each stage happens

| Stage | Site | Needs $\ce{O2}$? |
| --- | --- | --- |
| Glycolysis | Cytoplasm | No |
| Fermentation | Cytoplasm | No (anaerobic) |
| Pyruvate → acetyl CoA | Mitochondrial matrix | Yes (stops without it) |
| Krebs' cycle | Mitochondrial matrix | Yes (stops without it) |
| ETS + oxidative phosphorylation | Inner mitochondrial membrane | Yes ($\ce{O2}$ is the final acceptor) |

## Glycolysis (EMP pathway)

Glucose (6C) → 2 pyruvic acid (3C). Ten reactions, each with its own enzyme.

| Step | What happens |
| --- | --- |
| Glucose → glucose-6-phosphate | 1 ATP **used** (hexokinase) |
| Fructose-6-phosphate → fructose 1,6-bisphosphate | 1 ATP **used** |
| PGAL → BPGA (1,3-bisphosphoglycerate) | $\ce{NADH + H+}$ **made** |
| BPGA → PGA (3-phosphoglyceric acid) | ATP **made** |
| PEP → pyruvic acid | ATP **made** |

Fructose 1,6-bisphosphate splits into two 3C sugars (DHAP and PGAL), so the last three steps happen **twice** per glucose.

:::formula{title="Glycolysis balance (per glucose)"}
- ATP used: **2**
- ATP made directly: **4**
- Net ATP: **2**
- $\ce{NADH + H+}$ made: **2**
- Pyruvic acid made: **2**
:::

## Fermentation (no $\ce{O2}$)

:::formula{title="Alcoholic fermentation (yeast)"}
$$\begin{aligned} &\text{Pyruvic acid} + \ce{NADH + H+} \\ &\to \text{Ethanol} + \ce{CO2} + \ce{NAD+} \end{aligned}$$
Enzymes: **pyruvic acid decarboxylase** and **alcohol dehydrogenase**.
:::

:::formula{title="Lactic acid fermentation (some bacteria; muscle short of O₂)"}
$$\begin{aligned} &\text{Pyruvic acid} + \ce{NADH + H+} \\ &\to \text{Lactic acid} + \ce{NAD+} \end{aligned}$$
Enzyme: **lactate dehydrogenase**.
:::

:::formula{title="Fermentation balance (per glucose)"}
- Net ATP: **2** (all from glycolysis)
- Energy of glucose released: **less than 7%**
- The NADH from glycolysis is used up to reduce pyruvic acid, so it makes no ATP.
- Yeast dies when alcohol reaches about **13%**.
:::

## Aerobic respiration in the mitochondria

:::formula{title="Pyruvate to acetyl CoA (oxidative decarboxylation)"}
$$\begin{aligned} &\text{Pyruvic acid} + \text{CoA} + \ce{NAD+} \\ &\xrightarrow{\ce{Mg^2+}} \text{Acetyl CoA} + \ce{CO2} \\ &\quad + \ce{NADH + H+} \end{aligned}$$
Enzyme: **pyruvate dehydrogenase** (a complex). Site: matrix. Per glucose it runs **twice**: 2 NADH, 2 $\ce{CO2}$.
:::

:::formula{title="NCERT's summary equation (one pyruvic acid, in the matrix)"}
$$\begin{aligned} &\text{Pyruvic acid} + 4\ce{NAD+} \\ &+ \ce{FAD+} + 2\ce{H2O} \\ &+ \text{ADP} + \text{P}_i \\ &\to 3\ce{CO2} + 4\ce{NADH} \\ &\quad + 4\ce{H+} + \ce{FADH2} + \text{ATP} \end{aligned}$$
This covers the pyruvate → acetyl CoA step **and** one turn of Krebs' cycle. NCERT writes $\ce{FAD+}$. The oxidised form actually carries no charge, so most books write just **FAD**. Read both as the same molecule.
:::

| Krebs' cycle compound | Carbons |
| --- | --- |
| Acetyl CoA | 2C |
| Oxaloacetic acid (OAA) | 4C |
| Citric acid, isocitric acid | 6C |
| α-ketoglutaric acid | 5C |
| Succinyl CoA, succinic acid, malic acid | 4C |

:::formula{title="One turn of Krebs' cycle (one acetyl CoA)"}
- $\ce{CO2}$ released: **2** (citric acid → α-ketoglutaric acid → succinyl CoA)
- $\ce{NADH + H+}$: **3**
- $\ce{FADH2}$: **1** (succinic acid → malic acid)
- GTP → ATP: **1** (succinyl CoA → succinic acid; substrate-level phosphorylation)

Per glucose there are **2 turns**: 4 $\ce{CO2}$, 6 NADH, 2 $\ce{FADH2}$, 2 ATP.
:::

## Electron transport system (inner membrane)

| Complex | Name | Job |
| --- | --- | --- |
| I | NADH dehydrogenase | NADH → ubiquinone |
| II | Succinate dehydrogenase | $\ce{FADH2}$ → ubiquinone |
| III | Cytochrome $bc_1$ | Ubiquinol → cytochrome c |
| IV | Cytochrome c oxidase | Cyt $a$, $a_3$, two Cu centres; electrons → $\ce{O2}$ |
| V | ATP synthase ($F_0$ + $F_1$) | ADP + $\text{P}_i$ → ATP |

Mobile carriers: **ubiquinone** (inside the inner membrane) and **cytochrome c** (a small protein on the outer surface of the inner membrane, between III and IV).

:::formula{title="ATP from reduced coenzymes (NCERT values)"}
- 1 $\ce{NADH + H+}$ → **3 ATP**
- 1 $\ce{FADH2}$ → **2 ATP**
- Each ATP made by ATP synthase: **4 $\ce{H+}$** pass through $F_0$, from the intermembrane space into the matrix.
:::

## Respiratory balance sheet (one glucose, aerobic)

| Stage | Made directly | Reduced coenzymes | ATP |
| --- | --- | --- | --- |
| Glycolysis | 2 ATP (net) | 2 NADH | 2 + 6 = 8 |
| Pyruvate → acetyl CoA (×2) | none | 2 NADH | 6 |
| Krebs' cycle (×2) | 2 ATP | 6 NADH, 2 $\ce{FADH2}$ | 2 + 18 + 4 = 24 |
| **Total** | **4 ATP** | **10 NADH, 2 $\ce{FADH2}$** | **38** |

:::formula{title="Net gain: 38 ATP per glucose (NCERT)"}
$$4 + (10 \times 3) + (2 \times 2) = 38$$
Valid only on NCERT's four assumptions:
1. Glycolysis, Krebs' cycle and ETS run **one after another** in an orderly way, each substrate forming the next.
2. The **NADH made in glycolysis** is moved into the mitochondria and undergoes oxidative phosphorylation.
3. **No intermediate** is taken out to make other compounds.
4. **Only glucose** is respired; no other substrate enters part-way.

These are not really true in a living cell, so 38 is a **theoretical** figure.
:::

## Respiratory quotient

:::formula{title="Respiratory quotient (respiratory ratio)"}
$$\text{RQ} = \frac{\ce{CO2}\text{ evolved}}{\ce{O2}\text{ consumed}}$$
Both measured as **volumes** (at the same temperature and pressure). RQ has no unit. It depends on the **respiratory substrate**.
:::

:::formula{title="Carbohydrate (glucose), complete oxidation"}
$$\begin{aligned} & \ce{C6H12O6 + 6O2} \\ & \ce{-> 6CO2 + 6H2O} \end{aligned}$$
$$\text{RQ} = \frac{6\,\ce{CO2}}{6\,\ce{O2}} = 1.0$$
:::

:::formula{title="Fat (tripalmitin)"}
$$\begin{aligned} & \ce{2(C51H98O6) + 145O2} \\ & \ce{-> 102CO2 + 98H2O} \end{aligned}$$
$$\text{RQ} = \frac{102\,\ce{CO2}}{145\,\ce{O2}} = 0.7$$
:::

| Substrate | RQ |
| --- | --- |
| Carbohydrates | 1.0 |
| Fats | Less than 1 (tripalmitin 0.7) |
| Proteins | About 0.9 |
| Organic acids (exam extra: NEET syllabus, not NCERT) | More than 1 (malic acid 4/3 ≈ 1.33) |

In real organisms the substrate is usually a **mixture**. Pure proteins or pure fats are never the only substrate.
