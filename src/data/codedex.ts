import type { LocalizedText } from '@/data/types'

/** One line of Codédex text per Codémon (game text: always "Codémon", never "Pokémon") */
export const CODEDEX_TEXT: Record<string, LocalizedText> = {
  aqua: { fr: 'Son code coule comme une rivière : jamais une ligne de trop.', en: 'Its code flows like a river: never a line too many.' },
  pyro: { fr: 'Sa queue s’enflamme dès qu’il trouve un bug. Elle brûle souvent.', en: 'Its tail flares up whenever it finds a bug. It burns a lot.' },
  flora: { fr: 'Fait pousser des arbres de données dans son jardin. Adore les racines.', en: 'Grows data trees in its garden. Loves roots.' },
  rocka: { fr: 'Solide comme une constante. Rien ne le fait changer d’avis.', en: 'Solid as a constant. Nothing ever changes its mind.' },
  meta: { fr: 'Son corps d’acier est fait de classes parfaitement emboîtées.', en: 'Its steel body is built from classes that fit perfectly.' },
  volta: { fr: 'Exécute du code à la vitesse de l’éclair. À tenir loin des prises.', en: 'Runs code at lightning speed. Keep it away from power outlets.' },
  pura: { fr: 'Simple et lisible, comme un bon print(). Tout le monde l’aime.', en: 'Simple and readable, like a good print(). Everybody likes it.' },
  cryo: { fr: 'Il gèle les valeurs dans des tuples que personne ne peut modifier.', en: 'It freezes values into tuples nobody can change.' },
  comba: { fr: 'S’entraîne en boucle : for, while, et encore une série.', en: 'Trains in loops: for, while, and one more set.' },
  toxi: { fr: 'Ses erreurs sont contagieuses. Toujours l’attraper avec un try.', en: 'Its errors are contagious. Always catch it with a try.' },
  terra: { fr: 'Creuse jusqu’à la racine de chaque problème.', en: 'Digs down to the root of every problem.' },
  venta: { fr: 'Survole le code et repère les fautes de frappe d’en haut.', en: 'Flies over code and spots typos from above.' },
  psyka: { fr: 'Devine la valeur d’une variable avant même qu’on l’affiche.', en: 'Guesses a variable’s value before it is even printed.' },
  buga: { fr: 'Les bugs apparaissent partout où il passe. Les dresseurs le suivent pour les corriger.', en: 'Bugs appear wherever it goes. Trainers follow it to fix them.' },
  shadow: { fr: 'Hante les variables jamais utilisées. On dit qu’il vit dans None.', en: 'Haunts unused variables. Some say it lives inside None.' },
  draco: { fr: 'Une légende : il aurait écrit sa propre fonction récursive à la naissance.', en: 'A legend: it wrote its own recursive function the day it hatched.' },
  nympha: { fr: 'Rend chaque message d’erreur un peu plus gentil.', en: 'Makes every error message a little kinder.' },
  luna: { fr: 'Ne code que la nuit, en mode sombre, évidemment.', en: 'Only codes at night — in dark mode, of course.' },
}
