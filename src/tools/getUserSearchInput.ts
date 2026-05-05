import readline from "node:readline"
import {
  Observable,
} from "rxjs"

export const getUserSearchInput = () => (
  new Observable<
    number
  >((
    observer,
  ) => {
    // Switch to using `inquirer`.
    const readlineInterface = (
      readline
      .createInterface({
        input: (
          process
          .stdin
        ),
        output: (
          process
          .stdout
        ),
        terminal: false,
      })
    )

    readlineInterface
    .on(
      'line',
      (
        index,
      ) => {
        readlineInterface
        .close()

        observer
        .next(
          Number(
            index
          )
        )

        observer
        .complete()
      },
    )
  })
)
