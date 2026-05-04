export const subscribeCli = () => ({
  complete: () => {
    console.timeEnd("Command Runtime")
    process.exit()
  },
})
