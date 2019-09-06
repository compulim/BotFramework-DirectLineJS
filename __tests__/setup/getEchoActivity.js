export default function getEchoActivity(activity) {
  const {
    attachments: [
      { content:
        {
          activity: echoActivity
        } = {}
      } = {}
    ] = []
  } = activity;

  return echoActivity;
}
