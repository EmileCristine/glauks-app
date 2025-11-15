import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function Header() {
  
  return (
    <View style={styles.container}>
      <View style={[styles.sideContainer, styles.leftContainer]}>
        <Link href="/(tabs)/perfil" asChild>
          <TouchableOpacity>
            <View style={styles.circularFrame}>
              <Image
                style={styles.userImg}
                source={require('../../assets/images/userImg.jpeg')}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </Link>
      </View>

      <Link href="/(tabs)/home" asChild>
        <TouchableOpacity>
          <Image
            style={styles.logo}
            source={require('../../assets/images/logo-preto.png')}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Link>

      <View style={[styles.sideContainer, styles.rightContainer]}>
        <Link href="/(tabs)/emprestimo" asChild>
          <TouchableOpacity>
            <MaterialIcons name="notifications-none" size={30} color="black" />
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    height: 80,
    paddingTop: 45,
    marginBottom: 15
  },
  sideContainer: {
    width: 80,
    alignItems: 'center',
  },
  leftContainer: {
    alignItems: 'flex-start',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  circularFrame: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  userImg: {
    width: '100%',
    height: '100%',
  },
  logo: {
    width: 100,
    height: 100,
  },
});