import { StudentAlert } from '~/components/student-space/alerts/student-alert'

export const StudentAlerts = async () => {
  const mock = [
    {
      title: 'Colocation Créteil',
      city: 'Créteil (94300)',
      price: '300 € max.',
      colocation: true,
    },
    {
      title: 'Colocation Créteil',
      city: 'Créteil (94300)',
      price: '300 € max.',
      colocation: true,
    },
    {
      title: 'Colocation Créteil',
      city: 'Créteil (94300)',
      price: '300 € max.',
      colocation: true,
    },
    {
      title: 'Colocation Créteil',
      city: 'Créteil (94300)',
      price: '300 € max.',
      colocation: true,
    },
    {
      title: 'Colocation Créteil',
      city: 'Créteil (94300)',
      price: '300 € max.',
      colocation: true,
    },
  ]

  return (
    <>
      {mock.map((alert, index) => (
        <StudentAlert key={index} alert={alert} />
      ))}
    </>
  )
}
